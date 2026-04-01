import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdirSync, rmSync } from 'fs';
import { join, basename, resolve, isAbsolute } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { parseDnaFile } from './parsers/index.mjs';


/**
 * Resolve a DNA file path. Checks:
 *   1. As-is (absolute or relative to CWD)
 *   2. ~/Downloads/
 *   3. Home directory
 *   4. data/ directory in project
 */
function resolveDnaPath(raw) {
  if (!raw) return null;
  const candidates = [
    isAbsolute(raw) ? raw : resolve(raw),
    join(homedir(), 'Downloads', basename(raw)),
    join(homedir(), raw),
    join(homedir(), 'Desktop', basename(raw)),
    join(process.cwd(), 'data', basename(raw)),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return isAbsolute(raw) ? raw : resolve(raw); // fall back to original
}

// Track the active analysis subprocess
let activeChild = null;

/**
 * Parse a JSONL file safely, skipping malformed lines.
 * Returns an empty array if the file does not exist.
 */
function parseJsonlFile(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n').filter(line => line.trim().length > 0);
    const results = [];
    for (const line of lines) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // Skip malformed JSONL lines silently
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Read agent states from on-disk log files when orchestrator has no in-memory state.
 * Each agent writes a <agentId>.log file to <jobDir>/logs/.
 * We also look for a job-meta.json that may store agent metadata.
 */
function readAgentsFromDisk(jobDir) {
  const agents = {};
  const logsDir = join(jobDir, 'logs');
  if (!existsSync(logsDir)) return agents;

  try {
    const files = readdirSync(logsDir).filter(f => f.endsWith('.log'));
    for (const file of files) {
      const id = basename(file, '.log');
      const logPath = join(logsDir, file);
      const logStat = statSync(logPath);
      const logSize = logStat.size;
      const lastActivity = logStat.mtime.toISOString();

      // Read log to detect status and model
      let status = 'done';
      let model = 'haiku';
      try {
        const logContent = readFileSync(logPath, 'utf-8');
        // Check exit code from footer: "Agent X exited: code=0 signal=null"
        const exitMatch = logContent.match(/exited:\s*code=(\d+)/);
        if (exitMatch && exitMatch[1] !== '0') {
          status = 'error';
        } else if (!exitMatch) {
          // No exit line — agent might still be running or crashed hard
          const tail = logContent.slice(-500);
          if (/\[error\]|FATAL|Traceback|panic:/i.test(tail)) {
            status = 'error';
          } else if (logSize < 500 && !exitMatch) {
            status = 'error'; // Very small log with no exit = likely crashed
          }
        }
        // Parse model from log header: "Model: haiku (claude-haiku-4-5-20251001)"
        const modelMatch = logContent.slice(0, 500).match(/Model:\s*(\w+)/);
        if (modelMatch) model = modelMatch[1];
      } catch { /* ignore */ }

      const mdPath = join(logsDir, id + '.md');
      agents[id] = {
        label: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        model,
        status,
        logSize,
        lastActivity,
        hasMd: existsSync(mdPath),
        mdPath: existsSync(mdPath) ? mdPath : null,
      };
    }
  } catch { /* ignore */ }

  return agents;
}

/**
 * Determine the overall job status from the set of agent statuses.
 */
function deriveJobStatus(agents) {
  const statuses = Object.values(agents).map(a => a.status || 'waiting');
  if (statuses.length === 0) return 'idle';
  if (statuses.some(s => s === 'running' || s === 'spawning')) return 'running';
  if (statuses.every(s => s === 'done')) return 'complete';
  if (statuses.some(s => s === 'error')) return 'partial-error';
  return 'waiting';
}

/**
 * Create the Express API server for the Helix Genomics Agents dashboard.
 *
 * @param {object} config - Loaded configuration object
 * @param {string} stateDir - Path to the job state directory (contains JSONL files, agent logs, etc.)
 * @param {object} orchestrator - Agent orchestrator instance with spawnAgent() and restartAgent() methods
 * @returns {express.Application}
 */
export function createApiServer(config, stateDir, orchestrator) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve the React dashboard (built to dashboard/)
  const dashboardDir = join(process.cwd(), 'dashboard');
  app.use(express.static(dashboardDir));

  // SPA fallback — any non-API route serves index.html
  app.get('/', (req, res) => {
    const indexPath = join(dashboardDir, 'index.html');
    if (!existsSync(indexPath)) {
      return res.status(404).send('Dashboard not found. Run: cd dashboard-react && npm run build');
    }
    res.sendFile(indexPath);
  });

  /**
   * GET /api/status/:jobId
   *
   * Returns the current state of all agents, findings, and chat messages
   * for the given job. Polled by the dashboard every 3 seconds.
   *
   * Response shape:
   * {
   *   status: 'running' | 'complete' | 'idle' | 'partial-error' | 'waiting',
   *   agents: { [agentId]: { status, label, model, logSize, mdSize, hasMd, lastActivity } },
   *   findings: [ { gene, finding, confidence, variants, agent, category, timestamp } ],
   *   chat: [ { from, to, message, priority, timestamp } ]
   * }
   */
  app.get('/api/status/:jobId', (req, res) => {
    const { jobId } = req.params;

    try {
      // Build agent states from the orchestrator
      let agents = {};
      if (orchestrator && typeof orchestrator.getAgents === 'function') {
        agents = orchestrator.getAgents(jobId);
      } else if (orchestrator && typeof orchestrator.agents === 'object') {
        // Fallback: read directly from orchestrator's agents map
        const jobAgents = orchestrator.agents[jobId] || orchestrator.agents;
        if (jobAgents && typeof jobAgents === 'object') {
          agents = jobAgents;
        }
      }

      // Determine the job-specific state directory
      // Job folders may have a date prefix like "2026-03-31T07-04-38-job-123"
      let jobDir = stateDir;
      if (existsSync(join(stateDir, jobId))) {
        jobDir = join(stateDir, jobId);
      } else {
        try {
          const match = readdirSync(stateDir).find(d => d.endsWith(jobId) || d.includes(jobId));
          if (match) jobDir = join(stateDir, match);
        } catch { /* ignore */ }
      }

      // Fall back to reading agent state from disk logs if orchestrator has none
      if (Object.keys(agents).length === 0) {
        Object.assign(agents, readAgentsFromDisk(jobDir));
      }

      // Parse JSONL data files
      const findings = parseJsonlFile(join(jobDir, 'shared-findings.jsonl'));
      const chat = parseJsonlFile(join(jobDir, 'agent-chat.jsonl'));

      // Derive overall status
      const status = deriveJobStatus(agents);

      res.json({ status, agents, findings, chat });
    } catch (err) {
      console.error(`[api-server] Error fetching status for job ${req.params.jobId}:`, err.message);
      res.status(500).json({
        error: 'Failed to fetch job status',
        detail: err.message,
        status: 'error',
        agents: {},
        findings: [],
        chat: []
      });
    }
  });

  /**
   * GET /api/agent-md/:jobId/:agentId
   *
   * Returns the content of a finished agent's .md output file.
   */
  app.get('/api/agent-md/:jobId/:agentId', (req, res) => {
    const { jobId, agentId } = req.params;

    let jobDir = stateDir;
    if (existsSync(join(stateDir, jobId))) {
      jobDir = join(stateDir, jobId);
    } else {
      try {
        const match = readdirSync(stateDir).find(d => d.endsWith(jobId) || d.includes(jobId));
        if (match) jobDir = join(stateDir, match);
      } catch { /* ignore */ }
    }

    const mdPath = join(jobDir, 'logs', agentId + '.md');
    if (!existsSync(mdPath)) {
      return res.status(404).json({ error: 'No .md output found for this agent yet' });
    }

    try {
      const content = readFileSync(mdPath, 'utf-8');
      res.json({ content, path: mdPath, agentId });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read agent output', detail: err.message });
    }
  });

  /**
   * POST /api/spawn-agent
   *
   * Launch a new agent for a job. Called from the dashboard "+ Add Agent" button.
   *
   * Request body:
   * { jobId, id, label, model, prompt, saveMd, mdOutputPath }
   */
  app.post('/api/spawn-agent', (req, res) => {
    const { jobId, id, label, model, prompt, saveMd, mdOutputPath } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Agent id is required' });
    }
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    try {
      if (orchestrator && typeof orchestrator.spawnAgent === 'function') {
        orchestrator.spawnAgent({ jobId, id, label, model, prompt, saveMd, mdOutputPath });
        res.json({ ok: true, agentId: id, message: `Agent "${id}" spawning with model ${model || 'default'}` });
      } else {
        res.status(501).json({ error: 'Orchestrator not available or does not support spawnAgent()' });
      }
    } catch (err) {
      console.error(`[api-server] Error spawning agent "${id}":`, err.message);
      res.status(500).json({ error: 'Failed to spawn agent', detail: err.message });
    }
  });

  /**
   * POST /api/restart-agent
   *
   * Restart an existing agent, optionally with a different model.
   *
   * Request body:
   * { jobId, agentId, model }
   */
  app.post('/api/restart-agent', (req, res) => {
    const { jobId, agentId, model } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    try {
      if (orchestrator && typeof orchestrator.restartAgent === 'function') {
        orchestrator.restartAgent({ jobId, agentId, model });
        res.json({ ok: true, agentId, message: `Agent "${agentId}" restarting with model ${model || 'same'}` });
      } else {
        res.status(501).json({ error: 'Orchestrator not available or does not support restartAgent()' });
      }
    } catch (err) {
      console.error(`[api-server] Error restarting agent "${agentId}":`, err.message);
      res.status(500).json({ error: 'Failed to restart agent', detail: err.message });
    }
  });

  /**
   * Health check endpoint — also returns the most recent jobId so the
   * dashboard can auto-load without needing a ?jobId= query param.
   */
  app.get('/api/health', (req, res) => {
    let activeJobId = null;
    try {
      const dirs = readdirSync(stateDir)
        .filter(d => d.includes('job-'))
        .sort()
        .reverse();
      if (dirs.length > 0) {
        // Extract the short jobId from the directory name (everything after last dash-prefixed date)
        const dir = dirs[0];
        const m = dir.match(/(job-\d+)$/);
        activeJobId = m ? m[1] : dir;
      }
    } catch { /* ignore */ }

    res.json({
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      orchestratorAvailable: !!orchestrator,
      activeJobId,
      isAnalysisRunning: !!activeChild,
    });
  });

  /**
   * POST /api/start-analysis
   *
   * Spawns `node src/cli.mjs` as a subprocess with the user's config.
   * Returns immediately — don't wait for completion.
   */
  app.post('/api/start-analysis', (req, res) => {
    const { dnaPath, preset, settings, customAgents, agentOverrides } = req.body || {};

    if (!dnaPath) {
      return res.status(400).json({ error: 'dnaPath is required' });
    }

    // Kill any already-running child
    if (activeChild) {
      try { activeChild.kill(); } catch { /* ignore */ }
      activeChild = null;
    }

    const resolvedDnaPath = resolveDnaPath(dnaPath);
    const args = ['src/cli.mjs', '--dna', resolvedDnaPath, '--no-dashboard'];

    if (preset && preset !== 'custom') {
      args.push('--preset', preset);
    }

    if (settings) {
      if (settings.defaultModel) args.push('--model', settings.defaultModel);
      if (settings.costLimit != null) args.push('--cost-limit', String(settings.costLimit));
    }

    const env = { ...process.env };
    if (agentOverrides && Object.keys(agentOverrides).length > 0) {
      env.HELIX_AGENT_OVERRIDES = JSON.stringify(agentOverrides);
    }
    if (customAgents && customAgents.length > 0) {
      env.HELIX_CUSTOM_AGENTS = JSON.stringify(customAgents);
    }
    if (settings) {
      if (settings.temperature != null) env.HELIX_TEMPERATURE = String(settings.temperature);
      if (settings.maxToolCalls != null) env.HELIX_MAX_TOOL_CALLS = String(settings.maxToolCalls);
      if (settings.webSearch != null) env.HELIX_WEB_SEARCH = String(settings.webSearch);
    }

    try {
      activeChild = spawn(process.execPath, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'inherit', 'inherit'],
        env,
        detached: true,
      });

      // Detach so analysis survives server restarts
      activeChild.unref();

      activeChild.on('exit', (code) => {
        console.log(`[api-server] Analysis process exited with code ${code}`);
        activeChild = null;
      });

      activeChild.on('error', (err) => {
        console.error(`[api-server] Analysis process error: ${err.message}`);
        activeChild = null;
      });

      res.json({ ok: true, message: 'Analysis started', pid: activeChild.pid });
    } catch (err) {
      console.error('[api-server] Failed to spawn analysis process:', err.message);
      res.status(500).json({ error: 'Failed to start analysis', detail: err.message });
    }
  });

  /**
   * POST /api/stop-job
   *
   * Kills the running analysis subprocess.
   */
  app.post('/api/stop-job', (req, res) => {
    if (activeChild) {
      try {
        activeChild.kill('SIGTERM');
      } catch { /* ignore */ }
      activeChild = null;
    }
    res.json({ ok: true });
  });

  /**
   * POST /api/clear-job
   *
   * Kills the subprocess (if running) and deletes the job state directory
   * so the dashboard starts fresh on next load.
   * Body: { jobId }
   */
  app.post('/api/clear-job', (req, res) => {
    const { jobId } = req.body || {};

    // Kill any running child first
    if (activeChild) {
      try { activeChild.kill('SIGTERM'); } catch { /* ignore */ }
      activeChild = null;
    }

    if (!jobId) {
      return res.json({ ok: true, deleted: false });
    }

    // Find and delete the job directory
    let jobDir = null;
    if (existsSync(join(stateDir, jobId))) {
      jobDir = join(stateDir, jobId);
    } else {
      try {
        const match = readdirSync(stateDir).find(d => d.endsWith(jobId) || d.includes(jobId));
        if (match) jobDir = join(stateDir, match);
      } catch { /* ignore */ }
    }

    if (jobDir && existsSync(jobDir)) {
      try {
        rmSync(jobDir, { recursive: true, force: true });
        console.log(`[api-server] Deleted job directory: ${jobDir}`);
        return res.json({ ok: true, deleted: true, path: jobDir });
      } catch (err) {
        console.error(`[api-server] Failed to delete job dir: ${err.message}`);
        return res.status(500).json({ error: 'Failed to delete job data', detail: err.message });
      }
    }

    res.json({ ok: true, deleted: false });
  });

  /**
   * POST /api/inject-chat
   *
   * Appends a user message to the active job's agent-chat.jsonl.
   * Body: { jobId, message, from }
   */
  app.post('/api/inject-chat', (req, res) => {
    const { jobId, message, from } = req.body || {};

    if (!jobId || !message) {
      return res.status(400).json({ error: 'jobId and message are required' });
    }

    // Locate the job state directory
    let jobDir = stateDir;
    if (existsSync(join(stateDir, jobId))) {
      jobDir = join(stateDir, jobId);
    } else {
      try {
        const match = readdirSync(stateDir).find(d => d.endsWith(jobId) || d.includes(jobId));
        if (match) jobDir = join(stateDir, match);
      } catch { /* ignore */ }
    }

    const chatFile = join(jobDir, 'agent-chat.jsonl');
    const entry = {
      from: from || 'user',
      to: 'all',
      message,
      timestamp: new Date().toISOString(),
      priority: 'normal',
    };

    try {
      appendFileSync(chatFile, JSON.stringify(entry) + '\n', 'utf-8');
      res.json({ ok: true });
    } catch (err) {
      console.error('[api-server] Failed to inject chat message:', err.message);
      res.status(500).json({ error: 'Failed to inject message', detail: err.message });
    }
  });


  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/check-chip
  //
  // Quick chip analysis: detects provider, chip version, SNP count, sex,
  // and coverage stats. No analysis run — just file introspection.
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/check-chip', async (req, res) => {
    const { dnaPath } = req.body || {};
    if (!dnaPath) {
      return res.status(400).json({ error: 'dnaPath is required' });
    }

    const resolvedPath = resolveDnaPath(dnaPath);
    try {
      const parsed = await parseDnaFile(resolvedPath);
      const count = parsed.count;

      // Detect provider and chip version
      let provider = 'Unknown';
      let chipVersion = 'Unknown';

      if (parsed.format === '23andMe') {
        provider = '23andMe';
        if (count > 900000) chipVersion = 'v5+ (GSA chip)';
        else if (count > 600000) chipVersion = 'v4/v5';
        else if (count > 500000) chipVersion = 'v3';
        else chipVersion = 'v2 or earlier';
      } else if (parsed.format === 'AncestryDNA') {
        provider = 'AncestryDNA';
        if (count > 700000) chipVersion = 'v2+ chip';
        else chipVersion = 'v1 chip';
      } else if (parsed.format === 'MyHeritage') {
        provider = 'MyHeritage';
        chipVersion = 'Illumina OmniExpress';
      } else if (parsed.format === 'FamilyTreeDNA') {
        provider = 'FamilyTreeDNA';
        chipVersion = 'Illumina chip';
      } else if (parsed.format === 'VCF') {
        provider = 'VCF file';
        chipVersion = count > 1000000 ? 'Whole Genome / Imputed' : 'Genotyping chip';
      }

      // Detect sex from chrY/chrX genotype patterns
      let chrYCount = 0, chrXCount = 0, chrXHetCount = 0;
      for (const [, entry] of parsed.genotypes) {
        const geno = entry.genotype;
        if (!geno || geno === '--') continue;
        if (entry.chromosome === 'Y') {
          chrYCount++;
        } else if (entry.chromosome === 'X') {
          chrXCount++;
          if (geno.length === 2 && geno[0] !== geno[1]) chrXHetCount++;
        }
      }
      let sex = 'Not determined';
      if (chrYCount > 100) sex = 'Male (XY)';
      else if (chrYCount < 10 && chrXCount > 100 && (chrXHetCount / chrXCount) > 0.1) sex = 'Female (XX)';

      // Coverage stats (without reference DB, provide estimates)
      const estimatedImputed = Math.round(count * 46);

      res.json({
        provider,
        chipVersion,
        format: parsed.format,
        version: parsed.version,
        sex,
        snpCount: count,
        noCallRate: parsed.noCallRate,
        estimatedImputedSnps: estimatedImputed,
        build: parsed.metadata?.build || null,
        recommendation: count < 500000
          ? 'Your chip has limited coverage. Imputation is strongly recommended.'
          : count > 900000
          ? 'Excellent chip coverage! Imputation will still improve rare variant analysis.'
          : 'Good chip coverage. Imputation recommended for best results.',
      });
    } catch (err) {
      console.error('[api-server] Check-chip error:', err.message);
      res.status(400).json({ error: `Could not parse DNA file: ${err.message}` });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/db-status
  //
  // Returns row counts and build info for each annotation database table.
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/db-status', async (req, res) => {
    const dbPath = resolve(join(process.cwd(), 'data', 'helix-unified.db'));
    if (!existsSync(dbPath)) {
      return res.json({ ok: false, error: 'Database not found. Run: npm run build-db', databases: [], totalRows: 0 });
    }

    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath, { readonly: true });

      const tables = [
        { table: 'clinvar', label: 'ClinVar', desc: 'Clinical variant interpretations' },
        { table: 'gwas', label: 'GWAS Catalog', desc: 'Genome-wide associations' },
        { table: 'hpo', label: 'HPO', desc: 'Gene-phenotype links' },
        { table: 'orphanet', label: 'Orphanet', desc: 'Rare disease genes' },
        { table: 'civic', label: 'CIViC', desc: 'Cancer variant evidence' },
        { table: 'cpic_alleles', label: 'CPIC Alleles', desc: 'Pharmacogene alleles' },
        { table: 'cpic_recommendations', label: 'CPIC Recs', desc: 'Drug dosing guidelines' },
        { table: 'disgenet', label: 'DisGeNET', desc: 'Disease-gene associations' },
        { table: 'pharmgkb', label: 'PharmGKB', desc: 'Drug-gene annotations' },
        { table: 'snpedia', label: 'SNPedia', desc: 'Community SNP annotations' },
        { table: 'alphamissense', label: 'AlphaMissense', desc: 'Pathogenicity predictions' },
        { table: 'cadd', label: 'CADD', desc: 'Deleteriousness scores' },
        { table: 'gnomad', label: 'gnomAD', desc: 'Population frequencies' },
      ];

      const databases = [];
      let totalRows = 0;

      for (const t of tables) {
        try {
          const row = db.prepare(`SELECT COUNT(*) as count FROM ${t.table}`).get();
          const meta = db.prepare(`SELECT built_at, download_url FROM build_metadata WHERE source = ?`).get(t.table) ||
                       db.prepare(`SELECT built_at, download_url FROM build_metadata WHERE source LIKE ?`).get(t.label.toLowerCase() + '%');
          const count = row?.count || 0;
          totalRows += count;
          databases.push({
            name: t.label,
            table: t.table,
            description: t.desc,
            rows: count,
            status: count > 0 ? 'loaded' : 'empty',
            builtAt: meta?.built_at || null,
            source: meta?.download_url || null,
          });
        } catch {
          databases.push({ name: t.label, table: t.table, description: t.desc, rows: 0, status: 'error' });
        }
      }

      let dbSize = 0;
      try { dbSize = statSync(dbPath).size; } catch {}

      db.close();
      res.json({ ok: true, databases, totalRows, dbSize, dbPath });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, databases: [], totalRows: 0 });
    }
  });

  return app;
}
