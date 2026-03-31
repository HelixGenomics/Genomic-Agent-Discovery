#!/usr/bin/env node
/**
 * Capture an impressive GIF of the full analysis pipeline running.
 * Intercepts /api/health and /api/status to inject realistic mock data
 * that evolves through all pipeline phases.
 */
import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

const URL = 'http://localhost:5199';
const OUT = 'docs/screenshots';
const FRAMES_DIR = join(OUT, '_frames');

// ── Mock data ─────────────────────────────────────────────────────

function ts(minsAgo = 0) {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

function makeAgent(label, model, status, logSize, hasMd = false) {
  return { label, model, status, logSize, lastActivity: ts(), hasMd };
}

const FINDINGS_POOL = [
  { gene: 'BRCA2', finding: 'Patient carries rs80359065 (c.5946delT) — pathogenic frameshift in BRCA2 exon 11. Associated with hereditary breast and ovarian cancer syndrome (HBOC). Lifetime breast cancer risk ~70%, ovarian cancer risk ~45%.', confidence: 0.95, variants: ['rs80359065'], agent: 'cancer-collector', category: 'high', timestamp: ts(8) },
  { gene: 'CHEK2', finding: 'Heterozygous rs555607708 (c.1100delC) — moderate-penetrance breast cancer variant. 2-3x increased risk. Compound effect with BRCA2 finding significantly elevates overall cancer risk profile.', confidence: 0.88, variants: ['rs555607708'], agent: 'cancer-collector', category: 'moderate', timestamp: ts(7) },
  { gene: 'DPYD', finding: 'DPYD*2A carrier (IVS14+1G>A, rs3918290) — intermediate metabolizer for dihydropyrimidine dehydrogenase. CRITICAL: Reduce fluoropyrimidine (5-FU, capecitabine) dose by 50% per CPIC guidelines.', confidence: 0.97, variants: ['rs3918290'], agent: 'dpyd-safety', category: 'drug_response', timestamp: ts(6) },
  { gene: 'ERCC1', finding: 'ERCC1 rs11615 T/T — enhanced nucleotide excision repair. Associated with improved cisplatin response in NSCLC and ovarian cancer. Favorable for platinum-based regimens if needed.', confidence: 0.78, variants: ['rs11615'], agent: 'platinum-chemo', category: 'drug_response', timestamp: ts(5) },
  { gene: 'CYP2D6', finding: 'CYP2D6 poor metabolizer (*4/*5 diplotype) — critically impaired tamoxifen activation to endoxifen. Consider aromatase inhibitor instead of tamoxifen for endocrine therapy.', confidence: 0.91, variants: ['rs3892097', 'rs5030655'], agent: 'targeted-therapy', category: 'drug_response', timestamp: ts(4.5) },
  { gene: 'HLA-A', finding: 'HLA-A*02:01 positive — associated with favorable response to anti-PD-1 checkpoint inhibitor immunotherapy in multiple tumor types including melanoma and NSCLC.', confidence: 0.72, variants: ['HLA-A*02:01'], agent: 'immunotherapy', category: 'drug_response', timestamp: ts(4) },
  { gene: 'PALB2', finding: 'PALB2 rs515726136 — VUS in BRCA1-binding domain. AlphaMissense: 0.82 (likely pathogenic). Combined with BRCA2 pathogenic variant, suggests possible compound effect on homologous recombination repair.', confidence: 0.65, variants: ['rs515726136'], agent: 'cancer-collector', category: 'moderate', timestamp: ts(3.5) },
  { gene: 'GSTP1', finding: 'GSTP1 rs1695 A/G (Ile105Val) — heterozygous. Reduced glutathione S-transferase activity. May increase oxaliplatin neurotoxicity risk. Monitor closely if platinum therapy initiated.', confidence: 0.73, variants: ['rs1695'], agent: 'platinum-chemo', category: 'drug_response', timestamp: ts(3) },
  { gene: 'ATM', finding: 'ATM rs1801516 variant detected — moderate DNA damage response alteration. In context of BRCA2 pathogenic variant, may indicate broader homologous recombination deficiency (HRD). Consider PARP inhibitor eligibility.', confidence: 0.70, variants: ['rs1801516'], agent: 'targeted-therapy', category: 'moderate', timestamp: ts(2) },
];

const CHAT_POOL = [
  { from: 'cancer-collector', to: 'dpyd-safety', message: 'URGENT: Found BRCA2 pathogenic variant — patient may need chemotherapy. Check fluoropyrimidine metabolism immediately.', priority: 'urgent', timestamp: ts(8) },
  { from: 'dpyd-safety', to: 'all', message: 'CRITICAL ALERT: DPYD*2A carrier confirmed. ALL AGENTS: patient requires 50% dose reduction for any fluoropyrimidine-based chemotherapy.', priority: 'critical', timestamp: ts(7) },
  { from: 'cancer-collector', to: 'targeted-therapy', message: 'BRCA2 pathogenic + CHEK2 moderate-penetrance variants found. Check PARP inhibitor eligibility and tamoxifen metabolism.', priority: 'urgent', timestamp: ts(6) },
  { from: 'platinum-chemo', to: 'synthesizer', message: 'ERCC1 rs11615 T/T suggests favorable platinum response. Relevant given BRCA2 status and possible ovarian cancer treatment planning.', priority: 'normal', timestamp: ts(5) },
  { from: 'targeted-therapy', to: 'all', message: 'CYP2D6 poor metabolizer confirmed — tamoxifen will NOT be effectively activated. Recommend aromatase inhibitor for endocrine therapy.', priority: 'urgent', timestamp: ts(4.5) },
  { from: 'immunotherapy', to: 'synthesizer', message: 'HLA-A*02:01 positive — favorable checkpoint inhibitor response marker. No autoimmune risk alleles flagged for irAE prediction.', priority: 'normal', timestamp: ts(4) },
  { from: 'cancer-collector', to: 'synthesizer', message: 'PALB2 VUS with high AlphaMissense score (0.82) — may compound BRCA2 HRD effect. Recommend genetic counselor review.', priority: 'normal', timestamp: ts(3.5) },
  { from: 'synthesizer', to: 'narrator', message: 'Synthesis complete: BRCA2+CHEK2 compound risk, DPYD dose reduction critical, CYP2D6 tamoxifen alternative needed, PARP inhibitor eligible, favorable platinum response.', priority: 'normal', timestamp: ts(1) },
];

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // State that the interceptor reads
  let currentAgents = {};
  let currentFindings = [];
  let currentChat = [];
  let isRunning = true;
  const jobId = 'job-20260331-cancer';

  // Intercept API calls
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/health')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true, uptime: 120, timestamp: ts(),
          orchestratorAvailable: true, activeJobId: jobId, isAnalysisRunning: isRunning,
        }),
      });
    } else if (url.includes('/api/status/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: isRunning ? 'running' : 'complete',
          agents: currentAgents,
          findings: currentFindings,
          chat: currentChat,
        }),
      });
    } else {
      req.continue();
    }
  });

  // Load the page — should see dashboard view (no setup panel)
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(4500); // Wait for at least one poll cycle

  try { rmSync(FRAMES_DIR, { recursive: true }); } catch {}
  mkdirSync(FRAMES_DIR, { recursive: true });

  let frameNum = 0;
  async function snap(holdFrames = 1) {
    for (let i = 0; i < holdFrames; i++) {
      await page.screenshot({ path: join(FRAMES_DIR, `${String(frameNum).padStart(4, '0')}.png`) });
      frameNum++;
    }
  }

  async function waitPoll() {
    await sleep(3500); // Wait for poll to fetch new state
  }

  console.log('Pipeline GIF: Capturing frames…');

  // ── Phase 1: All agents spawning ────────────────────────────────
  console.log('  Agents spawning…');
  currentAgents = {
    'cancer-collector':  makeAgent('Cancer & Tumor Genetics',  'haiku',  'spawning', 0),
    'dpyd-safety':       makeAgent('DPYD Safety Agent',        'haiku',  'spawning', 0),
    'platinum-chemo':    makeAgent('Platinum Chemotherapy',     'haiku',  'spawning', 0),
    'immunotherapy':     makeAgent('Immunotherapy Markers',     'haiku',  'spawning', 0),
    'targeted-therapy':  makeAgent('Targeted Therapy',         'haiku',  'spawning', 0),
    'synthesizer':       makeAgent('Cancer Synthesizer',       'sonnet', 'waiting',  0),
    'narrator':          makeAgent('Report Writer',            'haiku',  'waiting',  0),
  };
  await waitPoll();
  await snap(3);

  // ── Phase 2: Collectors running ─────────────────────────────────
  console.log('  Collectors running…');
  for (const id of ['cancer-collector', 'dpyd-safety', 'platinum-chemo', 'immunotherapy', 'targeted-therapy']) {
    currentAgents[id].status = 'running';
    currentAgents[id].logSize = 1200;
  }
  await waitPoll();
  await snap(2);

  // Growing log sizes, first findings
  console.log('  First findings arriving…');
  for (const id of Object.keys(currentAgents)) {
    if (currentAgents[id].status === 'running') currentAgents[id].logSize += 4000;
  }
  currentFindings = FINDINGS_POOL.slice(0, 1);
  currentChat = CHAT_POOL.slice(0, 1);
  await waitPoll();
  await snap(2);

  // More findings + chat
  console.log('  More findings + agent chat…');
  for (const id of Object.keys(currentAgents)) {
    if (currentAgents[id].status === 'running') currentAgents[id].logSize += 3000;
  }
  currentFindings = FINDINGS_POOL.slice(0, 3);
  currentChat = CHAT_POOL.slice(0, 3);
  await waitPoll();
  await snap(2);

  // Even more
  for (const id of Object.keys(currentAgents)) {
    if (currentAgents[id].status === 'running') currentAgents[id].logSize += 2500;
  }
  currentFindings = FINDINGS_POOL.slice(0, 5);
  currentChat = CHAT_POOL.slice(0, 5);
  await waitPoll();
  await snap(2);

  // ── Phase 3: Collectors finishing ───────────────────────────────
  console.log('  Collectors finishing…');
  currentAgents['dpyd-safety'].status = 'done';
  currentAgents['dpyd-safety'].logSize = 14000;
  currentAgents['dpyd-safety'].hasMd = true;
  currentAgents['platinum-chemo'].status = 'done';
  currentAgents['platinum-chemo'].logSize = 11000;
  currentAgents['platinum-chemo'].hasMd = true;
  currentFindings = FINDINGS_POOL.slice(0, 6);
  currentChat = CHAT_POOL.slice(0, 6);
  await waitPoll();
  await snap(2);

  currentAgents['immunotherapy'].status = 'done';
  currentAgents['immunotherapy'].logSize = 9800;
  currentAgents['immunotherapy'].hasMd = true;
  currentAgents['targeted-therapy'].status = 'done';
  currentAgents['targeted-therapy'].logSize = 13200;
  currentAgents['targeted-therapy'].hasMd = true;
  currentFindings = FINDINGS_POOL.slice(0, 8);
  currentChat = CHAT_POOL.slice(0, 7);
  await waitPoll();
  await snap(2);

  currentAgents['cancer-collector'].status = 'done';
  currentAgents['cancer-collector'].logSize = 18000;
  currentAgents['cancer-collector'].hasMd = true;
  await waitPoll();
  await snap(2);

  // ── Phase 4: Synthesizer ────────────────────────────────────────
  console.log('  Synthesizer running…');
  currentAgents['synthesizer'].status = 'running';
  currentAgents['synthesizer'].logSize = 2000;
  await waitPoll();
  await snap(2);

  currentAgents['synthesizer'].logSize = 12000;
  currentFindings = [...FINDINGS_POOL];
  currentChat = CHAT_POOL.slice(0, 8);
  await waitPoll();
  await snap(2);

  currentAgents['synthesizer'].status = 'done';
  currentAgents['synthesizer'].logSize = 22000;
  currentAgents['synthesizer'].hasMd = true;
  await waitPoll();
  await snap(2);

  // ── Phase 5: Narrator ───────────────────────────────────────────
  console.log('  Narrator writing report…');
  currentAgents['narrator'].status = 'running';
  currentAgents['narrator'].logSize = 1500;
  await waitPoll();
  await snap(2);

  currentAgents['narrator'].logSize = 15000;
  await waitPoll();
  await snap(2);

  currentAgents['narrator'].status = 'done';
  currentAgents['narrator'].logSize = 28000;
  currentAgents['narrator'].hasMd = true;
  isRunning = false;
  await waitPoll();
  await snap(4); // Hold on final frame

  console.log(`  Captured ${frameNum} frames, assembling GIF…`);

  // Assemble with ffmpeg — 3fps for smoother animation
  const outPath = join(OUT, 'gif-pipeline-running.gif');
  try {
    execSync(
      `ffmpeg -y -framerate 3 -i "${FRAMES_DIR}/%04d.png" ` +
      `-vf "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
      `"${outPath}"`,
      { stdio: 'pipe' }
    );
    console.log(`  -> ${outPath} (${(statSync(outPath).size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`  !! ffmpeg failed: ${e.message}`);
  }

  try { rmSync(FRAMES_DIR, { recursive: true }); } catch {}

  await browser.close();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
