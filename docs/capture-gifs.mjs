#!/usr/bin/env node
/**
 * Capture animated GIFs for README documentation.
 * Uses puppeteer to capture frame sequences, ffmpeg to assemble GIFs.
 */
import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';
import { execSync, spawnSync } from 'child_process';
import { mkdirSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

const URL = 'http://localhost:5199';
const OUT = 'docs/screenshots';
const FRAMES_DIR = join(OUT, '_frames');

async function captureFrames(page, prefix, actions) {
  // Clean frames directory
  try { rmSync(FRAMES_DIR, { recursive: true }); } catch {}
  mkdirSync(FRAMES_DIR, { recursive: true });

  let frameNum = 0;
  async function snap(delayBefore = 0) {
    if (delayBefore) await sleep(delayBefore);
    const padded = String(frameNum).padStart(4, '0');
    await page.screenshot({ path: join(FRAMES_DIR, `${padded}.png`) });
    frameNum++;
  }

  for (const action of actions) {
    await action(snap, page);
  }

  // Assemble GIF with ffmpeg — 2fps, 720px wide, optimized palette
  const outPath = join(OUT, `${prefix}.gif`);
  try {
    execSync(
      `ffmpeg -y -framerate 2 -i "${FRAMES_DIR}/%04d.png" ` +
      `-vf "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
      `"${outPath}"`,
      { stdio: 'pipe' }
    );
    console.log(`  -> ${outPath}`);
  } catch (e) {
    console.error(`  !! ffmpeg failed for ${prefix}: ${e.message}`);
  }

  // Clean up frames
  try { rmSync(FRAMES_DIR, { recursive: true }); } catch {}
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Clear state
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1000);

  // ── GIF 1: Preset switching ─────────────────────────────────────
  console.log('GIF 1: Preset switching…');
  await captureFrames(page, 'gif-preset-switching', [
    // Start at Quick Scan
    async (snap) => { await snap(300); await snap(500); }, // hold 2 frames
    // Click Cancer Research
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[1]) await btns[1].click();
      await snap(400); await snap(400);
    },
    // Click Cardiovascular
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[2]) await btns[2].click();
      await snap(400); await snap(400);
    },
    // Click Pharmacogenomics
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[3]) await btns[3].click();
      await snap(400); await snap(400);
    },
    // Click Rare Disease
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[4]) await btns[4].click();
      await snap(400); await snap(400);
    },
    // Click Custom
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[5]) await btns[5].click();
      await snap(400); await snap(400);
    },
    // Back to Quick Scan
    async (snap, p) => {
      const btns = await p.$$('.setup-preset');
      if (btns[0]) await btns[0].click();
      await snap(400); await snap(800);
    },
  ]);

  // ── GIF 2: Prompt accordion ─────────────────────────────────────
  console.log('GIF 2: Prompt accordion…');
  // Switch to Cancer Research for this one (has many agents)
  const presets = await page.$$('.setup-preset');
  if (presets[1]) await presets[1].click();
  await sleep(500);
  // Scroll to prompts
  await page.evaluate(() => {
    const el = document.querySelector('.setup-agent-prompts');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(300);

  await captureFrames(page, 'gif-prompt-accordion', [
    // Show collapsed
    async (snap) => { await snap(300); await snap(500); },
    // Expand first prompt
    async (snap, p) => {
      const toggles = await p.$$('.setup-prompt-toggle');
      if (toggles[0]) await toggles[0].click();
      await snap(400); await snap(400); await snap(400);
    },
    // Expand second prompt
    async (snap, p) => {
      const toggles = await p.$$('.setup-prompt-toggle');
      if (toggles[1]) await toggles[1].click();
      await snap(400); await snap(400);
    },
    // Expand third
    async (snap, p) => {
      const toggles = await p.$$('.setup-prompt-toggle');
      if (toggles[2]) await toggles[2].click();
      await snap(400); await snap(400); await snap(400);
    },
    // Collapse first
    async (snap, p) => {
      const toggles = await p.$$('.setup-prompt-toggle');
      if (toggles[0]) await toggles[0].click();
      await snap(400); await snap(800);
    },
  ]);

  // ── GIF 3: Full config walkthrough (scrolling) ──────────────────
  console.log('GIF 3: Full config walkthrough…');
  // Reset to Quick Scan
  const presets2 = await page.$$('.setup-preset');
  if (presets2[0]) await presets2[0].click();
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);

  await captureFrames(page, 'gif-config-walkthrough', [
    // Top of page
    async (snap) => { await snap(300); await snap(500); },
    // Scroll to presets
    async (snap, p) => {
      await p.evaluate(() => {
        const el = document.querySelector('.setup-presets');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await snap(400); await snap(400);
    },
    // Scroll to prompts
    async (snap, p) => {
      await p.evaluate(() => {
        const el = document.querySelector('.setup-agent-prompts');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
      await snap(400); await snap(400);
    },
    // Expand a prompt
    async (snap, p) => {
      const toggles = await p.$$('.setup-prompt-toggle');
      if (toggles[0]) await toggles[0].click();
      await snap(400); await snap(400);
    },
    // Scroll to output config
    async (snap, p) => {
      await p.evaluate(() => {
        const el = document.querySelector('.setup-dir-preview') || document.querySelector('.setup-output-label');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await snap(400); await snap(400);
    },
    // Scroll to settings
    async (snap, p) => {
      await p.evaluate(() => {
        const el = document.querySelector('.setup-row');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await snap(400); await snap(400);
    },
    // Scroll to Start button
    async (snap, p) => {
      await p.evaluate(() => {
        const el = document.querySelector('.setup-start');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await snap(400); await snap(400); await snap(800);
    },
  ]);

  console.log('\nDone! GIFs saved to docs/screenshots/');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
