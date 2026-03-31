#!/usr/bin/env node
/**
 * Capture dashboard screenshots for README documentation.
 * Run from project root:  node docs/capture-screenshots.mjs
 */
import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';

const URL = 'http://localhost:5199';
const OUT = 'docs/screenshots';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Navigate and clear any stale localStorage so setup panel shows
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1200);

  // ── 1. Setup Panel — default state (Quick Scan selected) ────────
  console.log('1. Setup Panel default…');
  await page.screenshot({ path: `${OUT}/01-setup-panel.png` });

  // ── 2. Full setup panel (full page scroll) ──────────────────────
  console.log('2. Full setup panel…');
  await page.screenshot({ path: `${OUT}/02-setup-full.png`, fullPage: true });

  // ── 3. Presets grid — scroll into view ──────────────────────────
  console.log('3. Presets grid…');
  await page.evaluate(() => {
    const el = document.querySelector('.setup-presets');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/03-presets-grid.png` });

  // ── 4. Cancer Research preset ───────────────────────────────────
  console.log('4. Cancer Research preset…');
  const presetBtns = await page.$$('.setup-preset');
  if (presetBtns.length >= 2) {
    await presetBtns[1].click(); // Cancer Research
    await sleep(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await page.screenshot({ path: `${OUT}/04-cancer-preset.png`, fullPage: true });

  // ── 5. Agent prompt accordion (expand first prompt) ─────────────
  console.log('5. Agent prompts…');
  const toggles1 = await page.$$('.setup-prompt-toggle');
  if (toggles1.length > 0) {
    await toggles1[0].click(); // Expand first
    await sleep(300);
  }
  await page.evaluate(() => {
    const el = document.querySelector('.setup-prompt-body');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/05-agent-prompts.png` });

  // ── 6. Multiple prompts expanded ───────────────────────────────
  console.log('6. Multiple prompts expanded…');
  const toggles2 = await page.$$('.setup-prompt-toggle');
  if (toggles2.length >= 3) {
    await toggles2[1].click();
    await sleep(200);
    await toggles2[2].click();
    await sleep(200);
  }
  await page.evaluate(() => {
    const el = document.querySelector('.setup-agent-prompts');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/06-prompts-expanded.png` });

  // ── 7. Output directory section ─────────────────────────────────
  console.log('7. Output directory…');
  await page.evaluate(() => {
    const el = document.querySelector('.setup-dir-preview') || document.querySelector('.setup-output-label');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/07-output-config.png` });

  // ── 8. Settings row ─────────────────────────────────────────────
  console.log('8. Settings row…');
  await page.evaluate(() => {
    const el = document.querySelector('.setup-row');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/08-settings.png` });

  // ── 9. Custom preset with agent builder ─────────────────────────
  console.log('9. Custom preset…');
  const allPresets = await page.$$('.setup-preset');
  if (allPresets.length >= 6) {
    await allPresets[5].click(); // Custom
    await sleep(500);
  }
  await page.evaluate(() => {
    const el = document.querySelector('.setup-custom-agent');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/09-custom-preset.png` });

  // ── 10. Pharmacogenomics preset ─────────────────────────────────
  console.log('10. Pharmacogenomics preset…');
  const presets2 = await page.$$('.setup-preset');
  if (presets2.length >= 4) {
    await presets2[3].click(); // Pharmacogenomics
    await sleep(500);
  }
  // Expand first prompt
  const pharmaToggles = await page.$$('.setup-prompt-toggle');
  if (pharmaToggles.length > 0) {
    await pharmaToggles[0].click();
    await sleep(300);
  }
  await page.evaluate(() => {
    const el = document.querySelector('.setup-agent-prompts');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/10-pharma-preset.png` });

  // ── 11. Rare Disease preset ─────────────────────────────────────
  console.log('11. Rare Disease preset…');
  const presets3 = await page.$$('.setup-preset');
  if (presets3.length >= 5) {
    await presets3[4].click(); // Rare Disease
    await sleep(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await page.screenshot({ path: `${OUT}/11-rare-disease.png`, fullPage: true });

  // ── 12. Cardiovascular preset ───────────────────────────────────
  console.log('12. Cardiovascular preset…');
  const presets4 = await page.$$('.setup-preset');
  if (presets4.length >= 3) {
    await presets4[2].click(); // Cardiovascular
    await sleep(500);
  }
  // Expand a couple prompts
  const cardioToggles = await page.$$('.setup-prompt-toggle');
  if (cardioToggles.length >= 2) {
    await cardioToggles[0].click();
    await sleep(200);
  }
  await page.evaluate(() => {
    const el = document.querySelector('.setup-agent-prompts');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(200);
  await page.screenshot({ path: `${OUT}/12-cardio-preset.png` });

  console.log('\nDone! Screenshots saved to docs/screenshots/');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
