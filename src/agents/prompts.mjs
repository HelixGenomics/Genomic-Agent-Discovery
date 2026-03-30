// ============================================================
// Helix Genomics Agents — Prompt Builder
// ============================================================
//
// Builds the final system prompt and user prompt for an agent
// by combining:
//   1. Role default prompt (from roles.mjs)
//   2. Agent-level overrides (prompt, prompt_file, prompt_append)
//   3. Focus genes/conditions from config
//   4. Medical history from config
//   5. Global research focus from config
//
// Usage:
//   import { buildAgentPrompt } from "./prompts.mjs";
//   const { systemPrompt, userPrompt } = buildAgentPrompt(role, agentConfig, globalConfig);
//
// ============================================================

import { readFileSync, existsSync } from "fs";
import { resolve, isAbsolute } from "path";
import { getRole } from "./roles.mjs";

// ---------------------------------------------------------------------------
// Resolve a path that may be relative to the project root.
// ---------------------------------------------------------------------------

function resolvePath(filePath, projectRoot) {
  if (isAbsolute(filePath)) return filePath;
  return resolve(projectRoot || process.cwd(), filePath);
}

// ---------------------------------------------------------------------------
// Load prompt text from a file. Returns null if the file doesn't exist.
// ---------------------------------------------------------------------------

function loadPromptFile(filePath, projectRoot) {
  const resolved = resolvePath(filePath, projectRoot);
  if (!existsSync(resolved)) {
    console.warn(`[prompts] Prompt file not found: ${resolved}`);
    return null;
  }
  return readFileSync(resolved, "utf8").trim();
}

// ---------------------------------------------------------------------------
// Format a gene list for inclusion in a prompt.
// ---------------------------------------------------------------------------

function formatGeneList(genes) {
  if (!genes || genes.length === 0) return "";
  return genes.join(", ");
}

// ---------------------------------------------------------------------------
// Format a conditions list for inclusion in a prompt.
// ---------------------------------------------------------------------------

function formatConditionList(conditions) {
  if (!conditions || conditions.length === 0) return "";
  return conditions.map((c) => `- ${c}`).join("\n");
}

// ---------------------------------------------------------------------------
// Build the focus section that gets appended to the system prompt.
// Combines role-level focus genes with agent-level and global overrides.
// ---------------------------------------------------------------------------

function buildFocusSection(role, agentConfig, globalConfig) {
  const sections = [];

  // Merge focus genes: agent config overrides role defaults, global adds to both
  let focusGenes = [];
  if (agentConfig.focus_genes && agentConfig.focus_genes.length > 0) {
    // Agent-level focus genes replace role defaults
    focusGenes = [...agentConfig.focus_genes];
  } else if (role && role.focusGenes && role.focusGenes.length > 0) {
    focusGenes = [...role.focusGenes];
  }

  // Add global focus genes (these are always additive)
  if (globalConfig.research?.focus_genes) {
    for (const gene of globalConfig.research.focus_genes) {
      if (!focusGenes.includes(gene)) {
        focusGenes.push(gene);
      }
    }
  }

  if (focusGenes.length > 0) {
    sections.push(
      `## Focus Genes\n` +
      `Investigate these genes with particular attention: ${formatGeneList(focusGenes)}`
    );
  }

  // Focus conditions: agent config overrides, global adds
  let focusConditions = [];
  if (agentConfig.focus_conditions && agentConfig.focus_conditions.length > 0) {
    focusConditions = [...agentConfig.focus_conditions];
  }

  if (globalConfig.research?.focus_conditions) {
    for (const condition of globalConfig.research.focus_conditions) {
      if (!focusConditions.includes(condition)) {
        focusConditions.push(condition);
      }
    }
  }

  if (focusConditions.length > 0) {
    sections.push(
      `## Focus Conditions\n` +
      `Pay special attention to these conditions:\n${formatConditionList(focusConditions)}`
    );
  }

  // Focus variants from global config
  if (globalConfig.research?.focus_variants && globalConfig.research.focus_variants.length > 0) {
    sections.push(
      `## Priority Variants\n` +
      `Always check these specific variants regardless of other criteria:\n` +
      globalConfig.research.focus_variants.map((v) => `- ${v}`).join("\n")
    );
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Build the medical history section.
// ---------------------------------------------------------------------------

function buildMedicalHistorySection(globalConfig) {
  const history = globalConfig.input?.medical_history;
  if (!history || history.trim().length === 0) return "";

  return (
    `## Patient Medical History\n` +
    `The following medical history has been provided for this patient. ` +
    `Use this context to prioritize your analysis and identify relevant ` +
    `gene-condition associations:\n\n${history.trim()}`
  );
}

// ---------------------------------------------------------------------------
// Build the patient context section (sex, ancestry).
// ---------------------------------------------------------------------------

function buildPatientContextSection(globalConfig) {
  const parts = [];

  const sex = globalConfig.input?.sex;
  if (sex && sex !== "auto") {
    parts.push(`Reported biological sex: ${sex}`);
  }

  const ancestry = globalConfig.input?.ancestry;
  if (ancestry && ancestry !== "auto") {
    parts.push(`Reported genetic ancestry: ${ancestry}`);
  }

  if (parts.length === 0) return "";
  return `## Patient Context\n${parts.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Build the agent identity section (included in system prompt).
// ---------------------------------------------------------------------------

function buildAgentIdentitySection(agentConfig) {
  const lines = [
    `## Your Identity`,
    `Agent ID: ${agentConfig.id}`,
  ];
  if (agentConfig.label) {
    lines.push(`Role: ${agentConfig.label}`);
  }
  lines.push(
    ``,
    `You are part of a multi-agent genomics analysis pipeline. ` +
    `Other agents are working in parallel on different domains. ` +
    `Coordinate by checking messages periodically and sharing ` +
    `cross-domain discoveries.`
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Build the tool usage guidance section.
// ---------------------------------------------------------------------------

function buildToolGuidanceSection(agentConfig) {
  const maxFindings = agentConfig.max_findings ?? 10;
  const checkEvery = agentConfig.check_messages_every ?? 7;
  const webSearch = agentConfig.web_search !== false;

  const lines = [
    `## Tool Usage Guidelines`,
    `- Publish between 3 and ${maxFindings} findings using publish_finding`,
    `- Check messages from other agents every ${checkEvery} tool calls using get_messages`,
  ];

  if (webSearch) {
    lines.push(
      `- You may perform web searches for the latest research. Log each search with log_web_search BEFORE searching.`
    );
  } else {
    lines.push(
      `- Web search is disabled for this agent. Use only the database tools.`
    );
  }

  lines.push(
    `- Be efficient with tool calls — query_gene is usually better than individual variant lookups`,
    `- Every finding MUST include specific rsIDs and genotypes — vague findings are rejected`
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main export: buildAgentPrompt
// ---------------------------------------------------------------------------

/**
 * Build the final system prompt and user prompt for an agent.
 *
 * Resolution order for the base prompt:
 *   1. If agentConfig.prompt is set directly, use that
 *   2. If agentConfig.prompt_file is set, load from that file
 *   3. Otherwise, use the role's defaultPrompt
 *
 * Then append:
 *   - Agent identity
 *   - Tool usage guidelines
 *   - Focus genes/conditions
 *   - Patient context (sex, ancestry)
 *   - Medical history
 *   - agentConfig.prompt_append (if set)
 *
 * @param {object|string} roleOrId - Role object from roles.mjs, or a role ID string
 * @param {object} agentConfig - Per-agent config from the pipeline definition
 * @param {object} globalConfig - The full loaded config object
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildAgentPrompt(roleOrId, agentConfig, globalConfig) {
  // Resolve the role object
  let role = null;
  if (typeof roleOrId === "string") {
    role = getRole(roleOrId);
  } else if (roleOrId && typeof roleOrId === "object") {
    role = roleOrId;
  }

  const projectRoot = globalConfig._meta?.project_root || process.cwd();

  // -----------------------------------------------------------------------
  // Determine the base prompt text
  // -----------------------------------------------------------------------
  let basePrompt = "";

  if (agentConfig.prompt && typeof agentConfig.prompt === "string" && agentConfig.prompt.trim()) {
    // Direct inline prompt from agent config
    basePrompt = agentConfig.prompt.trim();
  } else if (agentConfig.prompt_file) {
    // Load from file
    const loaded = loadPromptFile(agentConfig.prompt_file, projectRoot);
    if (loaded) {
      basePrompt = loaded;
    } else {
      console.warn(
        `[prompts] Could not load prompt_file "${agentConfig.prompt_file}" for agent "${agentConfig.id}". ` +
        `Falling back to role default.`
      );
      basePrompt = role?.defaultPrompt || "";
    }
  } else {
    // Use role default
    basePrompt = role?.defaultPrompt || "";
  }

  // If we still have no prompt, provide a minimal fallback
  if (!basePrompt) {
    basePrompt =
      `You are a genomics analysis agent. Use the MCP tools to query the patient's ` +
      `genotype data and annotation databases. Publish your findings using publish_finding. ` +
      `Check messages from other agents periodically.`;
  }

  // -----------------------------------------------------------------------
  // Build the system prompt by assembling sections
  // -----------------------------------------------------------------------
  const systemSections = [
    basePrompt,
  ];

  // Agent identity
  const identitySection = buildAgentIdentitySection(agentConfig);
  if (identitySection) systemSections.push(identitySection);

  // Tool guidance
  const toolGuidance = buildToolGuidanceSection(agentConfig);
  if (toolGuidance) systemSections.push(toolGuidance);

  // Focus genes and conditions
  const focusSection = buildFocusSection(role, agentConfig, globalConfig);
  if (focusSection) systemSections.push(focusSection);

  // Patient context
  const patientContext = buildPatientContextSection(globalConfig);
  if (patientContext) systemSections.push(patientContext);

  // Medical history
  const medicalHistory = buildMedicalHistorySection(globalConfig);
  if (medicalHistory) systemSections.push(medicalHistory);

  // Prompt append (additional instructions from agent config)
  if (agentConfig.prompt_append && typeof agentConfig.prompt_append === "string") {
    systemSections.push(
      `## Additional Instructions\n${agentConfig.prompt_append.trim()}`
    );
  }

  const systemPrompt = systemSections.join("\n\n---\n\n");

  // -----------------------------------------------------------------------
  // Build the user prompt (the initial message to kick off the agent)
  // -----------------------------------------------------------------------
  const userPrompt = buildUserPrompt(agentConfig, globalConfig);

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Build the user prompt — the message that starts the agent's analysis.
// ---------------------------------------------------------------------------

function buildUserPrompt(agentConfig, globalConfig) {
  const parts = [];

  parts.push(
    `Begin your genomic analysis now. You have access to the patient's genotype database ` +
    `and comprehensive annotation databases (ClinVar, GWAS Catalog, PharmGKB, CPIC, ` +
    `AlphaMissense, CADD, HPO, DisGeNET, CIViC, Orphanet, SNPedia) through MCP tools.`
  );

  parts.push(
    `Start by calling get_patient_summary to understand the scope of data available, ` +
    `then systematically investigate your focus genes and conditions.`
  );

  // Remind about finding targets
  const maxFindings = agentConfig.max_findings ?? 10;
  parts.push(
    `Publish ${maxFindings > 0 ? `3 to ${maxFindings}` : "your"} most significant findings ` +
    `using publish_finding. Each finding must include specific rsIDs, genotypes, and clinical ` +
    `significance. Check messages from other agents periodically to stay coordinated.`
  );

  // If there are specific conditions or variants to prioritize
  if (globalConfig.research?.focus_conditions?.length > 0) {
    parts.push(
      `The patient has requested special attention to: ` +
      globalConfig.research.focus_conditions.join(", ") + `.`
    );
  }

  if (globalConfig.research?.focus_variants?.length > 0) {
    parts.push(
      `Priority variants to check: ` +
      globalConfig.research.focus_variants.join(", ") + `.`
    );
  }

  if (globalConfig.input?.medical_history) {
    parts.push(
      `Keep the patient's medical history in mind as you prioritize your investigation.`
    );
  }

  parts.push(`Begin.`);

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Utility: estimate prompt token count (rough approximation)
// ---------------------------------------------------------------------------

/**
 * Rough estimate of token count for a string.
 * Uses the ~4 characters per token heuristic.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
