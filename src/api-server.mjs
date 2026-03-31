import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
      const jobDir = existsSync(join(stateDir, jobId))
        ? join(stateDir, jobId)
        : stateDir;

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
   * Health check endpoint
   */
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      orchestratorAvailable: !!orchestrator
    });
  });

  return app;
}
