#!/usr/bin/env node
// ============================================================
// Helix Genomics Agents — MCP Server
// ============================================================
//
// Model Context Protocol server providing genomic analysis tools
// to AI agents. Each agent connects to this server and uses the
// tools below to query patient genotypes, annotation databases,
// share findings with other agents, and coordinate research.
//
// Architecture:
//   - Genotype DB: Patient's own DNA (rsid -> genotype)
//   - Unified DB:  Public annotation databases (ClinVar, GWAS,
//                  CPIC, AlphaMissense, SNPedia, HPO, etc.)
//   - State files: JSONL logs for findings, messages, searches
//
// All paths come from environment variables — no hardcoded paths.
//
// Environment variables:
//   UNIFIED_DB       Path to helix-unified.db (annotation databases)
//   GENOTYPE_DB      Path to patient genotype database
//   HELIX_STATE_DIR  Directory for shared state files (findings, chat, etc.)
//   HELIX_AGENT_ID   This agent's identifier (e.g. "cancer-collector")
//
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

const UNIFIED_DB_PATH  = process.env.UNIFIED_DB      || "";
const GENOTYPE_DB_PATH = process.env.GENOTYPE_DB      || "";
const STATE_DIR        = process.env.HELIX_STATE_DIR  || "./state";
const AGENT_ID         = process.env.HELIX_AGENT_ID   || "unknown";

// Ensure state directory exists
if (!existsSync(STATE_DIR)) {
  mkdirSync(STATE_DIR, { recursive: true });
}

// Shared state file paths
const FINDINGS_FILE  = join(STATE_DIR, "shared-findings.jsonl");
const CHAT_FILE      = join(STATE_DIR, "agent-chat.jsonl");
const WEBSEARCH_LOG  = join(STATE_DIR, "web-searches.jsonl");

// ---------------------------------------------------------------------------
// Database connections (lazy, read-only)
// ---------------------------------------------------------------------------

let _genotypeDb = null;
let _unifiedDb  = null;

/** Lazy-open the patient genotype database. */
function genotypeDb() {
  if (!_genotypeDb && GENOTYPE_DB_PATH) {
    try {
      _genotypeDb = new Database(GENOTYPE_DB_PATH, { readonly: true });
    } catch (e) {
      console.error(`[MCP] Failed to open genotype DB at ${GENOTYPE_DB_PATH}: ${e.message}`);
    }
  }
  return _genotypeDb;
}

/** Lazy-open the unified annotation database. */
function unifiedDb() {
  if (!_unifiedDb && UNIFIED_DB_PATH) {
    try {
      _unifiedDb = new Database(UNIFIED_DB_PATH, { readonly: true });
    } catch (e) {
      console.error(`[MCP] Failed to open unified DB at ${UNIFIED_DB_PATH}: ${e.message}`);
    }
  }
  return _unifiedDb;
}

// ---------------------------------------------------------------------------
// Utility: read JSONL state files
// ---------------------------------------------------------------------------

function readJsonlLines(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Utility: stop-word list for finding deduplication
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "this", "that", "with", "from", "have", "been", "their", "which", "will",
  "should", "could", "would", "also", "into", "than", "more", "they", "these",
  "those", "about", "after", "before", "between", "through", "during", "patient",
  "found", "gene", "variant", "associated", "risk", "evidence", "suggests",
]);

/**
 * Extract significant keywords (4+ chars, not stop words) from text.
 * Used for fuzzy dedup of findings and messages.
 */
function extractKeyTerms(text) {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || [];
  return words.filter((w) => !STOP_WORDS.has(w));
}

// ============================================================
// MCP Server — Tool Definitions
// ============================================================

const server = new McpServer({
  name: "helix-genomics",
  version: "2.0.0",
  description: "Genomic analysis tools for multi-agent research pipelines",
});

// ============================================================
// Section 1: Agent Communication & Coordination
// ============================================================

// --- publish_finding ---
server.tool(
  "publish_finding",
  "Share an important finding with other agents. Publish your 3-5 most significant " +
    "discoveries per analysis. Findings are deduplicated — if a very similar finding " +
    "already exists, you'll be asked to find a new angle.",
  {
    type: z.enum(["risk", "protective", "convergence", "pharmacogenomic", "notable"]),
    domain: z.string().describe("Research domain: cancer, cardio, neuro, metabolic, pharma, immune, etc."),
    gene: z.string().optional().describe("Primary gene symbol if applicable"),
    finding: z.string().describe("Clear description of the finding and its clinical significance"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
    variants: z.array(z.string()).optional().describe("Related rsIDs"),
  },
  async ({ type, domain, gene, finding, confidence, variants }) => {
    // Dedup: check existing findings for overlap
    const existing = readJsonlLines(FINDINGS_FILE);
    const findingLower = finding.toLowerCase();
    const keyTerms = extractKeyTerms(finding);

    for (const f of existing) {
      const existingLower = (f.finding || "").toLowerCase();

      // Check 1: Same gene + same opening text
      if (f.gene && gene && f.gene === gene) {
        if (findingLower.substring(0, 40) === existingLower.substring(0, 40)) {
          return {
            content: [{
              type: "text",
              text: `DUPLICATE — finding for ${gene} already published. Research something NEW instead.`,
            }],
          };
        }
      }

      // Check 2: High keyword overlap (>60% of significant terms match)
      if (keyTerms.length > 3) {
        const matches = keyTerms.filter((t) => existingLower.includes(t)).length;
        if (matches / keyTerms.length > 0.6) {
          return {
            content: [{
              type: "text",
              text: `DUPLICATE — very similar finding already published (${matches}/${keyTerms.length} key terms match). Find a NEW angle.`,
            }],
          };
        }
      }
    }

    // Write finding
    const entry = {
      timestamp: new Date().toISOString(),
      from: AGENT_ID,
      type,
      domain,
      gene: gene || null,
      finding,
      confidence,
      variants: variants || [],
    };
    appendFileSync(FINDINGS_FILE, JSON.stringify(entry) + "\n");
    return {
      content: [{ type: "text", text: `Finding published: [${type}] ${finding.substring(0, 100)}` }],
    };
  }
);

// --- get_phase1_findings ---
server.tool(
  "get_phase1_findings",
  "Read all findings published by other agents. Use to understand cross-domain patterns, " +
    "avoid duplicating research, and build on others' discoveries.",
  {},
  async () => {
    const findings = readJsonlLines(FINDINGS_FILE);
    if (!findings.length) {
      return { content: [{ type: "text", text: "No findings published yet." }] };
    }
    const summary = findings
      .map((f) =>
        `[${f.domain}/${f.type}] ${f.gene ? f.gene + ": " : ""}${f.finding} (confidence: ${f.confidence}, from: ${f.from})`
      )
      .join("\n");
    return {
      content: [{
        type: "text",
        text: `=== FINDINGS FROM ALL AGENTS (${findings.length} total) ===\n${summary}`,
      }],
    };
  }
);

// --- send_message ---
server.tool(
  "send_message",
  "Send a message to another agent or broadcast to all. Use to share discoveries, " +
    "ask questions, or alert others to important cross-domain connections. Messages " +
    "appear in a shared chatroom visible to all agents and the human operator.",
  {
    to: z.string().describe("Target agent ID or 'all' for broadcast"),
    message: z.string().describe("Your message — include specific variants/genes/findings"),
    priority: z.enum(["normal", "urgent", "critical"]).optional()
      .describe("Use 'critical' for safety-relevant alerts only"),
  },
  async ({ to, message, priority }) => {
    // Dedup: prevent identical messages
    const existing = readJsonlLines(CHAT_FILE);
    for (const m of existing) {
      if (m.to === to && m.message) {
        if (message.substring(0, 50).toLowerCase() === m.message.substring(0, 50).toLowerCase()) {
          return {
            content: [{
              type: "text",
              text: `DUPLICATE — similar message to ${to} already sent. Focus on new findings.`,
            }],
          };
        }
      }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      from: AGENT_ID,
      to: to || "all",
      priority: priority || "normal",
      message,
    };
    appendFileSync(CHAT_FILE, JSON.stringify(entry) + "\n");
    return {
      content: [{ type: "text", text: `Message sent to ${to}: ${message.substring(0, 100)}` }],
    };
  }
);

// --- get_messages ---
server.tool(
  "get_messages",
  "Check the agent chatroom for messages. Call every 5-10 tool uses to stay " +
    "coordinated with other agents. Returns messages addressed to you or broadcast.",
  {},
  async () => {
    const msgs = readJsonlLines(CHAT_FILE);
    const relevant = msgs.filter(
      (m) => m.to === AGENT_ID || m.to === "all" || m.from === AGENT_ID
    );
    if (!relevant.length) {
      return { content: [{ type: "text", text: "No messages for you yet." }] };
    }
    const formatted = relevant
      .map((m) => {
        const pri = m.priority === "critical" ? "CRITICAL: "
                  : m.priority === "urgent"   ? "URGENT: "
                  : "";
        return `[${m.timestamp.substring(11, 19)}] ${m.from} -> ${m.to}: ${pri}${m.message}`;
      })
      .join("\n");
    return {
      content: [{
        type: "text",
        text: `=== AGENT CHATROOM (${relevant.length} messages) ===\n${formatted}`,
      }],
    };
  }
);

// --- log_web_search ---
server.tool(
  "log_web_search",
  "Log a web search you are about to perform. Call BEFORE every web search to avoid " +
    "duplicate research across agents. Returns a warning if another agent already " +
    "searched for something similar.",
  {
    query: z.string().describe("The search query or URL you plan to search"),
  },
  async ({ query }) => {
    const entry = {
      timestamp: new Date().toISOString(),
      agent: AGENT_ID,
      query,
    };
    appendFileSync(WEBSEARCH_LOG, JSON.stringify(entry) + "\n");

    // Check for previous similar searches (excluding the one we just wrote)
    const all = readJsonlLines(WEBSEARCH_LOG);
    const prev = all.slice(0, -1);
    const queryLower = query.toLowerCase();
    const queryPrefix = queryLower.substring(0, 30);

    const dupes = prev.filter((p) => {
      const pLower = p.query.toLowerCase();
      return pLower.includes(queryPrefix) || queryLower.includes(pLower.substring(0, 30));
    });

    if (dupes.length > 0) {
      const agents = [...new Set(dupes.map((d) => d.agent))].join(", ");
      const queries = dupes.map((d) => d.query).join(" | ");
      return {
        content: [{
          type: "text",
          text: `WARNING: Similar search already done by ${agents}: ${queries}. Consider a different angle.`,
        }],
      };
    }
    return {
      content: [{ type: "text", text: "Search logged. No duplicates found — proceed." }],
    };
  }
);

// --- get_web_searches ---
server.tool(
  "get_web_searches",
  "See all web searches performed by all agents. Use to avoid duplicating research " +
    "and discover what others have already looked up.",
  {},
  async () => {
    const searches = readJsonlLines(WEBSEARCH_LOG);
    if (!searches.length) {
      return { content: [{ type: "text", text: "No web searches logged yet." }] };
    }
    const formatted = searches.map((s) => `[${s.agent}] ${s.query}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `=== WEB SEARCHES BY ALL AGENTS (${searches.length}) ===\n${formatted}`,
      }],
    };
  }
);

// ============================================================
// Section 2: Patient Genotype Queries
// ============================================================

// --- get_patient_summary ---
server.tool(
  "get_patient_summary",
  "Get a high-level summary of the patient's genotype data: total variant count, " +
    "chromosome distribution, sex (from X chromosome heterozygosity), and basic stats. " +
    "Call this first to understand the scope of data available.",
  {},
  async () => {
    const db = genotypeDb();
    if (!db) {
      return { content: [{ type: "text", text: "Genotype database not available. Check GENOTYPE_DB env var." }] };
    }

    try {
      const totalRow = db.prepare("SELECT COUNT(*) as total FROM genotypes").get();
      const total = totalRow?.total || 0;

      // Chromosome distribution
      const chrCounts = db.prepare(
        "SELECT chromosome, COUNT(*) as count FROM genotypes GROUP BY chromosome ORDER BY " +
        "CASE WHEN chromosome = 'X' THEN 23 WHEN chromosome = 'Y' THEN 24 WHEN chromosome = 'MT' THEN 25 " +
        "ELSE CAST(chromosome AS INTEGER) END"
      ).all();

      // Sex inference from X chromosome heterozygosity
      // Females have two X chromosomes (more het calls), males have one (mostly hom)
      let inferredSex = "unknown";
      const xTotal = db.prepare(
        "SELECT COUNT(*) as total FROM genotypes WHERE chromosome = 'X'"
      ).get();
      const xHet = db.prepare(
        "SELECT COUNT(*) as het FROM genotypes WHERE chromosome = 'X' AND " +
        "LENGTH(genotype) = 2 AND SUBSTR(genotype, 1, 1) != SUBSTR(genotype, 2, 1)"
      ).get();

      if (xTotal?.total > 100) {
        const hetRate = (xHet?.het || 0) / xTotal.total;
        inferredSex = hetRate > 0.15 ? "female (XX)" : "male (XY)";
      }

      // Check for Y chromosome presence as secondary signal
      const yCount = db.prepare(
        "SELECT COUNT(*) as count FROM genotypes WHERE chromosome = 'Y'"
      ).get();

      // Sample some genotypes to show data format
      const samples = db.prepare("SELECT * FROM genotypes LIMIT 5").all();

      const summary = {
        total_variants: total,
        inferred_sex: inferredSex,
        y_chromosome_variants: yCount?.count || 0,
        chromosome_distribution: Object.fromEntries(chrCounts.map((r) => [r.chromosome, r.count])),
        sample_records: samples,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error querying genotype DB: ${e.message}` }] };
    }
  }
);

// --- query_genotype ---
server.tool(
  "query_genotype",
  "Look up the patient's genotype for a specific rsID. Returns chromosome, position, " +
    "and the patient's alleles (e.g. 'AG', 'CC', 'TT').",
  { rsid: z.string().describe("dbSNP rsID, e.g. 'rs1234567'") },
  async ({ rsid }) => {
    const db = genotypeDb();
    if (!db) {
      return { content: [{ type: "text", text: "Genotype database not available." }] };
    }
    const row = db.prepare("SELECT * FROM genotypes WHERE rsid = ?").get(rsid);
    if (!row) {
      return { content: [{ type: "text", text: `${rsid} not found in patient genotypes.` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(row) }] };
  }
);

// --- query_genotypes_batch ---
server.tool(
  "query_genotypes_batch",
  "Look up patient genotypes for multiple rsIDs at once (up to 200). More efficient " +
    "than individual lookups when checking many variants.",
  { rsids: z.array(z.string()).max(200).describe("Array of rsIDs to look up") },
  async ({ rsids }) => {
    const db = genotypeDb();
    if (!db) {
      return { content: [{ type: "text", text: "Genotype database not available." }] };
    }
    const placeholders = rsids.map(() => "?").join(",");
    const rows = db.prepare(
      `SELECT * FROM genotypes WHERE rsid IN (${placeholders})`
    ).all(...rsids);
    return { content: [{ type: "text", text: JSON.stringify(rows) }] };
  }
);

// ============================================================
// Section 3: Annotation Database Queries
// ============================================================

// --- query_gene ---
server.tool(
  "query_gene",
  "Find ALL known variants for a gene by cross-referencing ClinVar, GWAS, and " +
    "AlphaMissense. Then checks which of those variants the patient actually carries. " +
    "This is the best starting point for investigating a specific gene.",
  { gene: z.string().describe("Gene symbol, e.g. 'BRCA1', 'CYP2D6'") },
  async ({ gene }) => {
    const u = unifiedDb();
    const g = genotypeDb();
    if (!u) {
      return { content: [{ type: "text", text: "Unified annotation database not available." }] };
    }

    // Collect all known rsIDs for this gene across databases
    const rsids = new Set();
    try {
      for (const row of u.prepare("SELECT DISTINCT rsid FROM clinvar WHERE gene = ?").all(gene)) {
        rsids.add(row.rsid);
      }
    } catch (e) { /* table may not exist */ }

    try {
      for (const row of u.prepare("SELECT DISTINCT rsid FROM gwas WHERE gene LIKE ?").all(`%${gene}%`)) {
        rsids.add(row.rsid);
      }
    } catch (e) { /* table may not exist */ }

    try {
      for (const row of u.prepare("SELECT DISTINCT rsid FROM alphamissense WHERE gene = ? LIMIT 100").all(gene)) {
        if (row.rsid) rsids.add(row.rsid);
      }
    } catch (e) { /* table may not exist */ }

    if (rsids.size === 0) {
      return { content: [{ type: "text", text: `No variants found for gene ${gene} in annotation databases.` }] };
    }

    // Check which variants the patient carries
    const results = [];
    if (g) {
      const arr = [...rsids];
      const placeholders = arr.map(() => "?").join(",");
      const genos = g.prepare(
        `SELECT * FROM genotypes WHERE rsid IN (${placeholders})`
      ).all(...arr);

      for (const geno of genos) {
        // Annotate with ClinVar significance
        let clinvar;
        try {
          clinvar = u.prepare(
            "SELECT significance, phenotype, review_status FROM clinvar WHERE rsid = ?"
          ).all(geno.rsid);
        } catch (e) { clinvar = []; }

        results.push({
          ...geno,
          clinvar: clinvar.length ? clinvar : undefined,
        });
      }
    }

    return {
      content: [{
        type: "text",
        text: `Found ${rsids.size} known variants for ${gene}, ${results.length} present in patient:\n` +
              JSON.stringify(results, null, 2),
      }],
    };
  }
);

// --- query_clinvar ---
server.tool(
  "query_clinvar",
  "Look up ClinVar clinical significance for a variant. Shows pathogenicity " +
    "classifications, associated phenotypes, and review status (star rating).",
  { rsid: z.string().describe("dbSNP rsID") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare("SELECT * FROM clinvar WHERE rsid = ?").all(rsid);
      return {
        content: [{
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : `${rsid} not in ClinVar.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `ClinVar query error: ${e.message}` }] };
    }
  }
);

// --- query_gwas ---
server.tool(
  "query_gwas",
  "Look up GWAS Catalog associations for a variant. Shows traits, p-values, " +
    "effect sizes, and study references from genome-wide association studies.",
  { rsid: z.string().describe("dbSNP rsID") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare("SELECT * FROM gwas WHERE rsid = ?").all(rsid);
      return {
        content: [{
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : `${rsid} not in GWAS Catalog.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `GWAS query error: ${e.message}` }] };
    }
  }
);

// --- query_alphamissense ---
server.tool(
  "query_alphamissense",
  "Look up AlphaMissense AI pathogenicity prediction for a missense variant. " +
    "Returns predicted pathogenicity class and score (0-1).",
  { rsid: z.string().describe("dbSNP rsID") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const row = u.prepare("SELECT * FROM alphamissense WHERE rsid = ?").get(rsid);
      return {
        content: [{
          type: "text",
          text: row ? JSON.stringify(row, null, 2) : `${rsid} not in AlphaMissense.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `AlphaMissense query error: ${e.message}` }] };
    }
  }
);

// --- query_cadd ---
server.tool(
  "query_cadd",
  "Look up CADD (Combined Annotation Dependent Depletion) score for a variant. " +
    "PHRED-scaled scores above 20 suggest top 1% most deleterious variants.",
  { rsid: z.string().describe("dbSNP rsID") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const row = u.prepare("SELECT * FROM myvariant_cadd WHERE rsid = ?").get(rsid);
      return {
        content: [{
          type: "text",
          text: row ? JSON.stringify(row, null, 2) : `${rsid} not in CADD database.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `CADD query error: ${e.message}` }] };
    }
  }
);

// --- query_hpo ---
server.tool(
  "query_hpo",
  "Find Human Phenotype Ontology terms associated with a gene. Shows which " +
    "clinical phenotypes (symptoms, findings) are linked to variants in this gene.",
  { gene: z.string().describe("Gene symbol") },
  async ({ gene }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare("SELECT * FROM hpo_genes WHERE gene = ?").all(gene);
      return {
        content: [{
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : `No HPO entries for ${gene}.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `HPO query error: ${e.message}` }] };
    }
  }
);

// --- query_disease_genes ---
server.tool(
  "query_disease_genes",
  "Find genes associated with a disease or condition using DisGeNET. Useful to " +
    "discover which genes to investigate for a particular health concern. Returns " +
    "genes ranked by association score.",
  { disease: z.string().describe("Disease name or keyword, e.g. 'breast cancer', 'diabetes'") },
  async ({ disease }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare(
        "SELECT * FROM disgenet WHERE disease LIKE ? ORDER BY score DESC LIMIT 50"
      ).all(`%${disease}%`);
      return {
        content: [{
          type: "text",
          text: rows.length
            ? JSON.stringify(rows, null, 2)
            : `No DisGeNET entries for "${disease}".`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `DisGeNET query error: ${e.message}` }] };
    }
  }
);

// --- query_civic ---
server.tool(
  "query_civic",
  "Search CIViC (Clinical Interpretation of Variants in Cancer) database. Returns " +
    "clinical evidence for cancer-relevant variants including therapeutic, diagnostic, " +
    "and prognostic annotations.",
  { search: z.string().describe("Gene name, disease, or variant to search for") },
  async ({ search }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare(
        "SELECT * FROM civic_variants WHERE gene LIKE ? OR disease LIKE ? OR variant LIKE ? LIMIT 30"
      ).all(`%${search}%`, `%${search}%`, `%${search}%`);
      return {
        content: [{
          type: "text",
          text: rows.length
            ? JSON.stringify(rows, null, 2)
            : `No CIViC entries for "${search}".`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `CIViC query error: ${e.message}` }] };
    }
  }
);

// --- query_pharmgkb ---
server.tool(
  "query_pharmgkb",
  "Look up PharmGKB pharmacogenomic annotations for a variant. Shows drug-gene " +
    "interactions, dosing guidelines, and clinical annotations.",
  { rsid: z.string().describe("dbSNP rsID") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare(
        "SELECT * FROM pharmgkb_annotations WHERE variant LIKE ?"
      ).all(`%${rsid}%`);
      return {
        content: [{
          type: "text",
          text: rows.length
            ? JSON.stringify(rows, null, 2)
            : `${rsid} not in PharmGKB.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `PharmGKB query error: ${e.message}` }] };
    }
  }
);

// --- query_snpedia ---
server.tool(
  "query_snpedia",
  "Look up SNPedia summary for a variant. SNPedia is a community-curated wiki of " +
    "SNP associations, providing plain-language explanations of what genotypes mean.",
  { rsid: z.string().describe("dbSNP rsID, e.g. 'rs1234567'") },
  async ({ rsid }) => {
    const u = unifiedDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    try {
      const rows = u.prepare("SELECT * FROM snpedia WHERE rsid = ?").all(rsid);
      if (!rows.length) {
        // Try case-insensitive match
        const rowsLike = u.prepare("SELECT * FROM snpedia WHERE rsid LIKE ?").all(rsid);
        if (rowsLike.length) {
          return { content: [{ type: "text", text: JSON.stringify(rowsLike, null, 2) }] };
        }
        return { content: [{ type: "text", text: `${rsid} not in SNPedia.` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `SNPedia query error: ${e.message}` }] };
    }
  }
);

// ============================================================
// Section 4: Pharmacogenomics
// ============================================================

// --- The 34 CPIC pharmacogenes with their key defining variants ---
const CPIC_GENES = {
  CYP2D6:  ["rs3892097", "rs1065852", "rs1135840", "rs16947", "rs28371725", "rs5030655", "rs5030656", "rs28371706", "rs59421388", "rs61736512"],
  CYP2C19: ["rs4244285", "rs4986893", "rs12248560", "rs28399504", "rs56337013", "rs72552267", "rs72558186", "rs41291556"],
  CYP2C9:  ["rs1799853", "rs1057910", "rs28371686", "rs7900194", "rs9332131", "rs56165452"],
  CYP2B6:  ["rs3745274", "rs2279343", "rs3211371", "rs28399499", "rs34223104"],
  CYP3A5:  ["rs776746", "rs10264272", "rs41303343"],
  CYP1A2:  ["rs762551", "rs2069514", "rs12720461"],
  CYP3A4:  ["rs35599367", "rs2740574"],
  CYP2C8:  ["rs11572080", "rs10509681", "rs11572103"],
  CYP4F2:  ["rs2108622"],
  DPYD:    ["rs3918290", "rs55886062", "rs67376798", "rs56038477", "rs75017182"],
  TPMT:    ["rs1800460", "rs1142345", "rs1800462"],
  NUDT15:  ["rs116855232", "rs147390019", "rs186364861"],
  UGT1A1:  ["rs8175347", "rs4148323", "rs35350960"],
  VKORC1:  ["rs9923231", "rs7294"],
  NAT2:    ["rs1801280", "rs1799930", "rs1799931", "rs1208", "rs1041983", "rs1801279"],
  SLCO1B1: ["rs4149056", "rs2306283"],
  ABCG2:   ["rs2231142"],
  IFNL3:   ["rs12979860", "rs8099917"],
  HLA_A:   ["rs1061235"],
  HLA_B:   ["rs3909184", "rs2395029"],
  G6PD:    ["rs1050828", "rs1050829", "rs5030868", "rs137852328"],
  CACNA1S: ["rs772226819"],
  RYR1:    ["rs118192172", "rs118192178"],
  CFTR:    ["rs75527207", "rs113993960", "rs74503330"],
  F5:      ["rs6025"],
  MT_RNR1: ["rs267606617"],
  COMT:    ["rs4680"],
  OPRM1:   ["rs1799971"],
  ANKK1:   ["rs1800497"],
  SLC6A4:  ["rs25531"],
  HTR2A:   ["rs7997012"],
  HTR2C:   ["rs3813929"],
  ADRA2A:  ["rs1800544"],
  CYP2A6:  ["rs28399433", "rs1801272", "rs28399444"],
};

// --- get_pharmacogenomics ---
server.tool(
  "get_pharmacogenomics",
  "Get pharmacogenomic results for a specific gene. Queries CPIC tables from the " +
    "unified database for allele definitions and drug recommendations, then checks " +
    "the patient's genotypes at defining variant positions.",
  { gene: z.string().describe("Pharmacogene symbol, e.g. 'CYP2D6', 'DPYD'") },
  async ({ gene }) => {
    const u = unifiedDb();
    const g = genotypeDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };

    const results = { gene, allele_definitions: [], patient_genotypes: [], recommendations: [], diplotypes: [] };

    // 1. CPIC allele definitions
    try {
      results.allele_definitions = u.prepare(
        "SELECT * FROM cpic_allele_definitions WHERE gene = ?"
      ).all(gene);
    } catch (e) { /* table may not exist */ }

    // 2. Patient genotypes for this gene's key variants
    const geneUpper = gene.toUpperCase().replace("-", "_");
    const keyVariants = CPIC_GENES[geneUpper] || [];
    if (g && keyVariants.length > 0) {
      const placeholders = keyVariants.map(() => "?").join(",");
      try {
        results.patient_genotypes = g.prepare(
          `SELECT * FROM genotypes WHERE rsid IN (${placeholders})`
        ).all(...keyVariants);
      } catch (e) { /* ignore */ }
    }

    // 3. CPIC drug recommendations for this gene
    try {
      results.recommendations = u.prepare(
        "SELECT * FROM cpic_recommendations WHERE gene = ?"
      ).all(gene);
    } catch (e) { /* table may not exist */ }

    // 4. Known diplotype-phenotype mappings
    try {
      results.diplotypes = u.prepare(
        "SELECT * FROM cpic_diplotypes WHERE gene = ?"
      ).all(gene);
    } catch (e) { /* table may not exist */ }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }],
    };
  }
);

// --- get_all_pharmacogenomics ---
server.tool(
  "get_all_pharmacogenomics",
  "Get a complete pharmacogenomics panel across all 34 CPIC pharmacogenes. For each " +
    "gene, retrieves the patient's genotypes at key defining variant positions and " +
    "looks up CPIC allele definitions to derive star alleles. This is the comprehensive " +
    "starting point for pharmacogenomic analysis.",
  {},
  async () => {
    const u = unifiedDb();
    const g = genotypeDb();
    if (!u) return { content: [{ type: "text", text: "Unified DB not available." }] };
    if (!g) return { content: [{ type: "text", text: "Genotype DB not available." }] };

    const allResults = {};

    for (const [gene, keyVariants] of Object.entries(CPIC_GENES)) {
      const entry = { key_variants: keyVariants, patient_genotypes: {}, allele_info: [], recommendations_count: 0 };

      // Look up patient genotypes for this gene's defining positions
      if (keyVariants.length > 0) {
        const placeholders = keyVariants.map(() => "?").join(",");
        try {
          const rows = g.prepare(
            `SELECT rsid, genotype FROM genotypes WHERE rsid IN (${placeholders})`
          ).all(...keyVariants);
          for (const row of rows) {
            entry.patient_genotypes[row.rsid] = row.genotype;
          }
        } catch (e) { /* ignore */ }
      }

      // Get allele definitions for context
      try {
        entry.allele_info = u.prepare(
          "SELECT allele, activity_value FROM cpic_allele_definitions WHERE gene = ? LIMIT 20"
        ).all(gene);
      } catch (e) { /* table may not exist */ }

      // Count available drug recommendations
      try {
        const countRow = u.prepare(
          "SELECT COUNT(*) as count FROM cpic_recommendations WHERE gene = ?"
        ).get(gene);
        entry.recommendations_count = countRow?.count || 0;
      } catch (e) { /* table may not exist */ }

      // Only include genes where we found patient data or have recommendations
      if (Object.keys(entry.patient_genotypes).length > 0 || entry.recommendations_count > 0) {
        allResults[gene] = entry;
      }
    }

    const genesWithData = Object.keys(allResults).length;
    const totalGenotyped = Object.values(allResults).reduce(
      (sum, e) => sum + Object.keys(e.patient_genotypes).length, 0
    );

    return {
      content: [{
        type: "text",
        text: `=== PHARMACOGENOMICS PANEL: ${genesWithData}/34 genes with data, ` +
              `${totalGenotyped} variants genotyped ===\n` +
              JSON.stringify(allResults, null, 2),
      }],
    };
  }
);

// ============================================================
// Start server
// ============================================================

console.error(`[Helix MCP] Agent: ${AGENT_ID}`);
console.error(`[Helix MCP] Genotype DB: ${GENOTYPE_DB_PATH || "(not configured)"}`);
console.error(`[Helix MCP] Unified DB: ${UNIFIED_DB_PATH || "(not configured)"}`);
console.error(`[Helix MCP] State dir: ${STATE_DIR}`);

const transport = new StdioServerTransport();
await server.connect(transport);
