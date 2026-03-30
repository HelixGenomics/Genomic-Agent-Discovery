// ============================================================
// Helix Genomics Agents — Pipeline Orchestrator
// ============================================================
//
// The core engine that manages the entire analysis lifecycle:
//
//   1. Parse the DNA file
//   2. Create the patient genotype database
//   3. Initialize state directory with JSONL files
//   4. Start the dashboard API server
//   5. Execute pipeline phases in dependency order
//   6. Spawn and monitor agent processes
//   7. Track cost estimates
//   8. Aggregate findings and generate reports
//
// Usage:
//   import { Orchestrator } from "./orchestrator.mjs";
//   const orch = new Orchestrator(config);
//   await orch.run();
//
// ============================================================

import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { parseDnaFile } from "./parsers/index.mjs";
import { createGenotypeDb } from "./db/genotype-db.mjs";
import { getPhaseOrder, getAllAgents, resolveProjectPath } from "./config-loader.mjs";
import { createApiServer } from "./api-server.mjs";
import { buildAgentPrompt, estimateTokens } from "./agents/prompts.mjs";
import { getRole } from "./agents/roles.mjs";
import { spawnAgent, writeMcpConfig, killAgent, isClaudeCliAvailable } from "./agents/spawner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Cost estimation constants (per million tokens, USD)
// ---------------------------------------------------------------------------

const COST_PER_MILLION = {
  haiku:  { input: 0.80,  output: 4.00  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};

/**
 * Estimate the USD cost for an agent based on log file size.
 * Assumes ~4 chars per token, 60/40 input/output split.
 */
function estimateCost(model, logSizeBytes) {
  const rates = COST_PER_MILLION[model] || COST_PER_MILLION.haiku;
  const estimatedTokens = logSizeBytes / 4;
  const inputTokens = estimatedTokens * 0.6;
  const outputTokens = estimatedTokens * 0.4;
  const cost =
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;
  return Math.round(cost * 10000) / 10000; // 4 decimal places
}

// ---------------------------------------------------------------------------
// Agent state tracking
// ---------------------------------------------------------------------------

/**
 * Create a new agent state object.
 */
function createAgentState(agentConfig, phaseId) {
  return {
    id: agentConfig.id,
    label: agentConfig.label || agentConfig.id,
    model: agentConfig.model || "haiku",
    phase: phaseId,
    status: "waiting",    // waiting | spawning | running | done | error
    logPath: null,
    logSize: 0,
    costEstimate: 0,
    startTime: null,
    endTime: null,
    exitCode: null,
    error: null,
    handle: null,         // process handle from spawner (not serialized)
  };
}

// ============================================================
// Orchestrator Class
// ============================================================

export class Orchestrator {

  /**
   * @param {object} config - Loaded and validated configuration object
   */
  constructor(config) {
    this.config = config;
    this.projectRoot = config._meta?.project_root || PROJECT_ROOT;

    // Job metadata
    this.jobId = `job-${Date.now()}`;
    this.startTime = null;
    this.endTime = null;
    this.status = "idle"; // idle | initializing | running | complete | error

    // State directory for this job
    this.stateDir = null;

    // Database paths
    this.genotypeDbPath = null;
    this.unifiedDbPath = null;

    // Agent states keyed by agent ID
    this.agents = {};

    // Completed phase IDs
    this.completedPhases = new Set();

    // API server reference
    this.server = null;
    this.serverPort = null;

    // Cost tracking
    this.totalCost = 0;
    this.costLimitReached = false;
  }

  // -----------------------------------------------------------------------
  // Main entry point — runs the full pipeline
  // -----------------------------------------------------------------------

  async run() {
    this.startTime = new Date();
    this.status = "initializing";

    try {
      // Step 1: Create the state directory
      this.stateDir = this._initStateDir();
      console.log(`[orchestrator] State directory: ${this.stateDir}`);

      // Step 2: Resolve the unified database path
      this.unifiedDbPath = this._resolveUnifiedDbPath();
      console.log(`[orchestrator] Unified DB: ${this.unifiedDbPath}`);

      // Step 3: Parse the DNA file
      console.log(`[orchestrator] Parsing DNA file...`);
      const parsedDna = await this._parseDnaFile();
      console.log(
        `[orchestrator] Parsed ${parsedDna.count.toLocaleString()} genotypes ` +
        `(${parsedDna.format}, ${parsedDna.version || "unknown version"})`
      );

      // Step 4: Create the patient genotype database
      console.log(`[orchestrator] Building genotype database...`);
      this.genotypeDbPath = createGenotypeDb(this.stateDir, parsedDna);
      console.log(`[orchestrator] Genotype DB: ${this.genotypeDbPath}`);

      // Step 5: Initialize state files
      this._initStateFiles();

      // Step 6: Initialize agent states from config
      this._initAgentStates();

      // Step 7: Start the dashboard API server
      if (this.config.dashboard?.enabled !== false) {
        await this._startApiServer();
      }

      // Step 8: Execute pipeline phases
      this.status = "running";
      console.log(`[orchestrator] Starting pipeline execution...`);
      console.log(`[orchestrator] Claude CLI available: ${isClaudeCliAvailable()}`);

      await this._executePipeline();

      // Step 9: Aggregate results
      this.status = "complete";
      this.endTime = new Date();

      const elapsed = ((this.endTime - this.startTime) / 1000).toFixed(1);
      console.log(`[orchestrator] Pipeline complete in ${elapsed}s`);
      console.log(`[orchestrator] Total estimated cost: $${this.totalCost.toFixed(4)}`);

      return this._buildResult();

    } catch (err) {
      this.status = "error";
      this.endTime = new Date();
      console.error(`[orchestrator] Pipeline error: ${err.message}`);
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Public API: getAgents (for dashboard/API server)
  // -----------------------------------------------------------------------

  /**
   * Return a snapshot of all agent states, suitable for JSON serialization.
   * @param {string} [jobId] - Ignored (single-job orchestrator)
   * @returns {object} Map of agentId -> state
   */
  getAgents(jobId) {
    const snapshot = {};
    for (const [id, state] of Object.entries(this.agents)) {
      // Update live stats before returning
      if (state.logPath && state.status === "running") {
        try {
          state.logSize = statSync(state.logPath).size;
          state.costEstimate = estimateCost(state.model, state.logSize);
        } catch {
          // File may not exist yet
        }
      }

      // Return a serializable copy (no process handle)
      snapshot[id] = {
        id: state.id,
        label: state.label,
        model: state.model,
        phase: state.phase,
        status: state.status,
        logSize: state.logSize,
        costEstimate: state.costEstimate,
        startTime: state.startTime,
        endTime: state.endTime,
        exitCode: state.exitCode,
        error: state.error,
        lastActivity: state.logSize > 0 ? "active" : "idle",
      };
    }
    return snapshot;
  }

  // -----------------------------------------------------------------------
  // Public API: spawnAgent (from dashboard)
  // -----------------------------------------------------------------------

  /**
   * Spawn a new agent (e.g., from the dashboard "+ Add Agent" button).
   * @param {object} opts
   * @param {string} opts.id - Agent identifier
   * @param {string} [opts.label] - Display label
   * @param {string} [opts.model] - Model name
   * @param {string} [opts.prompt] - Custom prompt (overrides role)
   * @param {string} [opts.role] - Role ID to use
   */
  async spawnAgent(opts) {
    const { id, label, model, prompt, role } = opts;

    if (this.agents[id]) {
      throw new Error(`Agent "${id}" already exists. Use restartAgent() instead.`);
    }

    // Build the agent config
    const agentConfig = {
      id,
      label: label || id,
      model: model || this.config.agent_defaults?.model || "haiku",
      role: role || id,
      prompt: prompt || undefined,
      max_findings: 10,
      web_search: true,
      check_messages_every: 7,
    };

    // Create state
    this.agents[id] = createAgentState(agentConfig, "manual");

    // Spawn the agent
    await this._spawnSingleAgent(agentConfig);
  }

  // -----------------------------------------------------------------------
  // Public API: restartAgent
  // -----------------------------------------------------------------------

  /**
   * Restart an existing agent, optionally with a different model.
   * Kills the current process if running.
   * @param {object} opts
   * @param {string} opts.agentId - Agent to restart
   * @param {string} [opts.model] - New model (or keep existing)
   */
  async restartAgent(opts) {
    const { agentId, model } = opts;
    const state = this.agents[agentId];

    if (!state) {
      throw new Error(`Agent "${agentId}" not found.`);
    }

    // Kill existing process if running
    if (state.handle && state.status === "running") {
      console.log(`[orchestrator] Killing agent "${agentId}" for restart...`);
      killAgent(state.handle);
    }

    // Update model if specified
    if (model) {
      state.model = model;
    }

    // Reset state
    state.status = "waiting";
    state.startTime = null;
    state.endTime = null;
    state.exitCode = null;
    state.error = null;
    state.logSize = 0;
    state.costEstimate = 0;
    state.handle = null;

    // Re-derive the agent config from the original pipeline config
    const allAgents = getAllAgents(this.config);
    const originalConfig = allAgents.find((a) => a.id === agentId) || {
      id: agentId,
      label: state.label,
      model: state.model,
      role: agentId,
      max_findings: 10,
      web_search: true,
    };

    if (model) {
      originalConfig.model = model;
    }

    // Spawn the agent
    await this._spawnSingleAgent(originalConfig);
  }

  // -----------------------------------------------------------------------
  // Internal: Initialize state directory
  // -----------------------------------------------------------------------

  _initStateDir() {
    const baseStateDir = resolveProjectPath(
      this.config.advanced?.state_directory || "./state"
    );

    // Create a timestamped subdirectory for this job
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const stateDir = join(baseStateDir, `${timestamp}-${this.jobId}`);

    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(stateDir, "logs"), { recursive: true });
    mkdirSync(join(stateDir, "mcp-configs"), { recursive: true });

    // Write job metadata
    const meta = {
      jobId: this.jobId,
      startTime: new Date().toISOString(),
      config: {
        dnaFile: this.config.input?.dna_file,
        defaultModel: this.config.agent_defaults?.model,
        preset: this.config._meta?.preset,
      },
    };
    writeFileSync(join(stateDir, "job-meta.json"), JSON.stringify(meta, null, 2));

    return stateDir;
  }

  // -----------------------------------------------------------------------
  // Internal: Resolve unified database path
  // -----------------------------------------------------------------------

  _resolveUnifiedDbPath() {
    const dbPath = resolveProjectPath(
      this.config.database?.path || "./data/helix-unified.db"
    );

    if (!existsSync(dbPath)) {
      console.warn(
        `[orchestrator] WARNING: Unified database not found at ${dbPath}. ` +
        `Agents will have limited annotation capabilities. ` +
        `Run 'helix-agents build-db' to create it.`
      );
    }

    return dbPath;
  }

  // -----------------------------------------------------------------------
  // Internal: Parse DNA file
  // -----------------------------------------------------------------------

  async _parseDnaFile() {
    const dnaFile = this.config.input?.dna_file;
    if (!dnaFile) {
      throw new Error(
        "No DNA file specified. Use --dna-file or set input.dna_file in config."
      );
    }

    const dnaPath = resolve(process.cwd(), dnaFile);
    if (!existsSync(dnaPath)) {
      throw new Error(`DNA file not found: ${dnaPath}`);
    }

    const forceFormat = this.config.input?.format !== "auto"
      ? this.config.input.format
      : undefined;

    return await parseDnaFile(dnaPath, forceFormat);
  }

  // -----------------------------------------------------------------------
  // Internal: Initialize empty state files
  // -----------------------------------------------------------------------

  _initStateFiles() {
    const files = [
      "shared-findings.jsonl",
      "agent-chat.jsonl",
      "web-searches.jsonl",
    ];

    for (const file of files) {
      const filePath = join(this.stateDir, file);
      if (!existsSync(filePath)) {
        writeFileSync(filePath, "", "utf8");
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Initialize agent states from pipeline config
  // -----------------------------------------------------------------------

  _initAgentStates() {
    const phases = getPhaseOrder(this.config);

    for (const phase of phases) {
      for (const agent of phase.agents) {
        this.agents[agent.id] = createAgentState(agent, phase.id);
      }
    }

    const agentCount = Object.keys(this.agents).length;
    const phaseCount = phases.length;
    console.log(`[orchestrator] Initialized ${agentCount} agents across ${phaseCount} phases`);
  }

  // -----------------------------------------------------------------------
  // Internal: Start the API server for the dashboard
  // -----------------------------------------------------------------------

  async _startApiServer() {
    const port = this.config.dashboard?.port || 3000;

    const app = createApiServer(this.config, this.stateDir, this);

    return new Promise((resolve, reject) => {
      this.server = app.listen(port, () => {
        this.serverPort = port;
        console.log(`[orchestrator] Dashboard: http://localhost:${port}`);
        console.log(`[orchestrator] API status: http://localhost:${port}/api/status/${this.jobId}`);

        // Optionally open the browser
        if (this.config.dashboard?.open_browser) {
          this._openBrowser(`http://localhost:${port}?jobId=${this.jobId}`);
        }

        resolve();
      });

      this.server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.warn(
            `[orchestrator] Port ${port} in use. Dashboard disabled. ` +
            `Use --port to specify a different port.`
          );
          resolve(); // Not fatal
        } else {
          reject(err);
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Internal: Open the dashboard in the default browser
  // -----------------------------------------------------------------------

  async _openBrowser(url) {
    try {
      const openModule = await import("open");
      const open = openModule.default;
      await open(url);
    } catch {
      // open package may not be available; not fatal
      console.log(`[orchestrator] Open browser manually: ${url}`);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Execute the pipeline phases in order
  // -----------------------------------------------------------------------

  async _executePipeline() {
    const phases = getPhaseOrder(this.config);

    for (const phase of phases) {
      // Check dependencies
      if (phase.wait_for) {
        const deps = Array.isArray(phase.wait_for) ? phase.wait_for : [phase.wait_for];
        for (const dep of deps) {
          if (!this.completedPhases.has(dep)) {
            console.log(`[orchestrator] Phase "${phase.id}" waiting for "${dep}"...`);
            await this._waitForPhase(dep);
          }
        }
      }

      console.log(
        `[orchestrator] Starting phase "${phase.id}" (${phase.label || phase.id}) ` +
        `— ${phase.agents.length} agent(s), parallel=${phase.parallel !== false}`
      );

      // Spawn agents for this phase
      if (phase.parallel !== false) {
        // Spawn all agents simultaneously, respecting concurrency limit
        await this._spawnPhaseParallel(phase);
      } else {
        // Spawn agents sequentially
        await this._spawnPhaseSequential(phase);
      }

      // Wait for all agents in this phase to complete
      await this._waitForPhaseAgents(phase);

      // Check cost limit
      this._updateTotalCost();
      if (this._checkCostLimit()) {
        console.error(
          `[orchestrator] COST LIMIT REACHED ($${this.totalCost.toFixed(2)} >= ` +
          `$${this.config.cost?.hard_limit_usd}). Aborting remaining phases.`
        );
        this._killAllAgents();
        break;
      }

      this.completedPhases.add(phase.id);
      console.log(`[orchestrator] Phase "${phase.id}" complete`);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Spawn all agents in a phase in parallel
  // -----------------------------------------------------------------------

  async _spawnPhaseParallel(phase) {
    const concurrencyLimit = this.config.advanced?.concurrency_limit || 5;
    const agents = phase.agents;

    // Spawn in batches respecting concurrency limit
    for (let i = 0; i < agents.length; i += concurrencyLimit) {
      const batch = agents.slice(i, i + concurrencyLimit);
      const promises = batch.map((agentConfig) =>
        this._spawnSingleAgent(agentConfig).catch((err) => {
          console.error(`[orchestrator] Failed to spawn agent "${agentConfig.id}": ${err.message}`);
          if (this.agents[agentConfig.id]) {
            this.agents[agentConfig.id].status = "error";
            this.agents[agentConfig.id].error = err.message;
          }
        })
      );
      await Promise.all(promises);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Spawn agents in a phase sequentially
  // -----------------------------------------------------------------------

  async _spawnPhaseSequential(phase) {
    for (const agentConfig of phase.agents) {
      try {
        await this._spawnSingleAgent(agentConfig);

        // Wait for this agent to complete before spawning the next
        const state = this.agents[agentConfig.id];
        if (state?.handle?.exitPromise) {
          await state.handle.exitPromise;
          this._finalizeAgent(agentConfig.id);
        }
      } catch (err) {
        console.error(`[orchestrator] Failed to spawn agent "${agentConfig.id}": ${err.message}`);
        if (this.agents[agentConfig.id]) {
          this.agents[agentConfig.id].status = "error";
          this.agents[agentConfig.id].error = err.message;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Spawn a single agent
  // -----------------------------------------------------------------------

  async _spawnSingleAgent(agentConfig) {
    const agentId = agentConfig.id;
    const state = this.agents[agentId];

    if (!state) {
      // Create state if it doesn't exist (e.g., manually spawned)
      this.agents[agentId] = createAgentState(agentConfig, "manual");
    }

    this.agents[agentId].status = "spawning";
    this.agents[agentId].startTime = new Date().toISOString();

    // Resolve the role
    const roleId = agentConfig.role || agentId;
    const role = getRole(roleId);

    // Build prompts
    const { systemPrompt, userPrompt } = buildAgentPrompt(
      role || roleId,
      agentConfig,
      this.config
    );

    // Log prompt sizes
    const sysTokens = estimateTokens(systemPrompt);
    const userTokens = estimateTokens(userPrompt);
    console.log(
      `[orchestrator] Agent "${agentId}": model=${agentConfig.model}, ` +
      `prompt ~${sysTokens + userTokens} tokens (sys: ${sysTokens}, user: ${userTokens})`
    );

    // Write the MCP config for this agent
    const mcpConfigPath = join(this.stateDir, "mcp-configs", `${agentId}.mcp.json`);
    writeMcpConfig({
      agentId,
      stateDir: this.stateDir,
      genotypeDbPath: this.genotypeDbPath,
      unifiedDbPath: this.unifiedDbPath,
      mcpServerPath: join(this.projectRoot, "src", "mcp-server.mjs"),
      outputPath: mcpConfigPath,
    });

    // Spawn the agent process
    const handle = await spawnAgent(
      {
        id: agentId,
        model: agentConfig.model || "haiku",
        systemPrompt,
        userPrompt,
        maxTokens: agentConfig.max_tokens || this.config.agent_defaults?.max_tokens || 16384,
      },
      mcpConfigPath,
      this.stateDir,
      {
        apiKey: this.config.api?.key,
        projectRoot: this.projectRoot,
      }
    );

    // Update state
    this.agents[agentId].status = "running";
    this.agents[agentId].logPath = handle.logPath;
    this.agents[agentId].handle = handle;

    console.log(
      `[orchestrator] Agent "${agentId}" spawned (${handle.mode} mode` +
      `${handle.pid ? `, pid=${handle.pid}` : ""})`
    );

    // Set up completion handler
    handle.exitPromise.then((result) => {
      this._finalizeAgent(agentId, result);
    });

    return handle;
  }

  // -----------------------------------------------------------------------
  // Internal: Finalize an agent after it exits
  // -----------------------------------------------------------------------

  _finalizeAgent(agentId, result) {
    const state = this.agents[agentId];
    if (!state) return;

    // Skip if already finalized
    if (state.status === "done" || state.status === "error") return;

    state.endTime = new Date().toISOString();

    // Update log size and cost
    if (state.logPath) {
      try {
        state.logSize = statSync(state.logPath).size;
      } catch {
        // File may have been cleaned up
      }
    }
    state.costEstimate = estimateCost(state.model, state.logSize);

    if (result) {
      state.exitCode = result.code ?? null;
      if (result.error) {
        state.error = result.error;
      }
    }

    // Determine final status
    if (result?.code === 0 || result?.code === null) {
      state.status = "done";
    } else {
      state.status = "error";
      if (!state.error) {
        state.error = `Process exited with code ${result?.code}`;
      }
    }

    const elapsed = state.startTime
      ? ((new Date(state.endTime) - new Date(state.startTime)) / 1000).toFixed(1)
      : "?";

    console.log(
      `[orchestrator] Agent "${agentId}" ${state.status} ` +
      `(${elapsed}s, ~$${state.costEstimate.toFixed(4)}, ${(state.logSize / 1024).toFixed(1)} KB log)`
    );
  }

  // -----------------------------------------------------------------------
  // Internal: Wait for a specific phase to complete
  // -----------------------------------------------------------------------

  _waitForPhase(phaseId) {
    return new Promise((resolve) => {
      const check = () => {
        if (this.completedPhases.has(phaseId)) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  // -----------------------------------------------------------------------
  // Internal: Wait for all agents in a phase to complete
  // -----------------------------------------------------------------------

  async _waitForPhaseAgents(phase) {
    const promises = [];

    for (const agentConfig of phase.agents) {
      const state = this.agents[agentConfig.id];
      if (state?.handle?.exitPromise) {
        promises.push(state.handle.exitPromise);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);

      // Finalize any agents that haven't been finalized yet
      for (const agentConfig of phase.agents) {
        const state = this.agents[agentConfig.id];
        if (state && state.status === "running") {
          this._finalizeAgent(agentConfig.id, { code: 0 });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Cost tracking
  // -----------------------------------------------------------------------

  _updateTotalCost() {
    let total = 0;
    for (const state of Object.values(this.agents)) {
      // Refresh log size for running agents
      if (state.logPath && state.status !== "waiting") {
        try {
          state.logSize = statSync(state.logPath).size;
          state.costEstimate = estimateCost(state.model, state.logSize);
        } catch {
          // Ignore
        }
      }
      total += state.costEstimate;
    }
    this.totalCost = total;
    return total;
  }

  _checkCostLimit() {
    const hardLimit = this.config.cost?.hard_limit_usd;
    if (!hardLimit || hardLimit <= 0) return false;
    return this.totalCost >= hardLimit;
  }

  // -----------------------------------------------------------------------
  // Internal: Kill all running agents
  // -----------------------------------------------------------------------

  _killAllAgents() {
    for (const state of Object.values(this.agents)) {
      if (state.status === "running" && state.handle) {
        killAgent(state.handle);
        state.status = "error";
        state.error = "Killed: cost limit reached";
        state.endTime = new Date().toISOString();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Build final result object
  // -----------------------------------------------------------------------

  _buildResult() {
    // Read findings from the state directory
    const findingsPath = join(this.stateDir, "shared-findings.jsonl");
    const chatPath = join(this.stateDir, "agent-chat.jsonl");

    const findings = this._readJsonl(findingsPath);
    const chat = this._readJsonl(chatPath);

    // Build agent summary
    const agentSummary = {};
    for (const [id, state] of Object.entries(this.agents)) {
      agentSummary[id] = {
        id: state.id,
        label: state.label,
        model: state.model,
        phase: state.phase,
        status: state.status,
        logSize: state.logSize,
        costEstimate: state.costEstimate,
        startTime: state.startTime,
        endTime: state.endTime,
        exitCode: state.exitCode,
        error: state.error,
      };
    }

    return {
      jobId: this.jobId,
      status: this.status,
      startTime: this.startTime?.toISOString(),
      endTime: this.endTime?.toISOString(),
      elapsedSeconds: this.endTime && this.startTime
        ? (this.endTime - this.startTime) / 1000
        : null,
      totalCost: this.totalCost,
      stateDir: this.stateDir,
      findings,
      findingsCount: findings.length,
      chat,
      chatCount: chat.length,
      agents: agentSummary,
      completedPhases: [...this.completedPhases],
      dashboardUrl: this.serverPort
        ? `http://localhost:${this.serverPort}?jobId=${this.jobId}`
        : null,
    };
  }

  // -----------------------------------------------------------------------
  // Internal: Read a JSONL file
  // -----------------------------------------------------------------------

  _readJsonl(filePath) {
    if (!existsSync(filePath)) return [];
    try {
      return readFileSync(filePath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
