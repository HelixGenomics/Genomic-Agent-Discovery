import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

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

      // Read last few lines of log to guess status
      let status = 'done';
      try {
        const tail = readFileSync(logPath, 'utf-8').slice(-2000);
        if (/error|failed|exception/i.test(tail) && !/completed|finished/i.test(tail.slice(-200))) {
          status = 'error';
        }
      } catch { /* ignore */ }

      agents[id] = {
        label: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        model: 'haiku',
        status,
        logSize,
        lastActivity,
        hasMd: existsSync(join(logsDir, id + '.md')),
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
   * POST /api/spawn-agent
   *
   * Launch a new agent for a job. Called from the dashboard "+ Add Agent" button.
   *
   * Request body:
   * { jobId, id, label, model, prompt }
   */
  app.post('/api/spawn-agent', (req, res) => {
    const { jobId, id, label, model, prompt } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Agent id is required' });
    }
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    try {
      if (orchestrator && typeof orchestrator.spawnAgent === 'function') {
        orchestrator.spawnAgent({ jobId, id, label, model, prompt });
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
    });
  });

  return app;
}
