#!/usr/bin/env node
/**
 * Capture screenshots of new dashboard features:
 * - Database status panel
 * - Template import/export buttons
 * - Editable agent prompts with tier grouping
 *
 * Run: node docs/capture-new-features.mjs
 * Requires server running on localhost:3000
 */
import puppeteer from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';

const URL = 'http://localhost:3000';
const OUT = 'docs/screenshots';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,1200'],
    defaultViewport: { width: 1440, height: 1200, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 10000 });
  await sleep(2000); // let DB status load

  // Screenshot 1: Full setup panel with DB status visible
  console.log('Capturing setup panel overview...');
  await page.screenshot({ path: `${OUT}/02-setup-with-db-status.png`, fullPage: false });

  // Screenshot 2: Click to expand DB status
  console.log('Expanding database status...');
  const dbToggle = await page.$('.setup-db-toggle');
  if (dbToggle) {
    await dbToggle.click();
    await sleep(500);
    // Scroll to make DB grid visible
    await page.evaluate(() => {
      const el = document.querySelector('.setup-db-grid');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await sleep(300);
    await page.screenshot({ path: `${OUT}/03-database-status-expanded.png`, fullPage: false });
  }

  // Screenshot 3: Show import/export buttons and preset selector
  console.log('Capturing template import/export...');
  await page.evaluate(() => {
    const el = document.querySelector('.setup-template-bar');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/04-template-import-export.png`, fullPage: false });

  // Screenshot 4: Select cancer preset and expand an agent prompt
  console.log('Selecting Cancer Research preset...');
  const presetButtons = await page.$$('.setup-preset');
  // Cancer is the second preset (index 1)
  if (presetButtons.length > 1) {
    await presetButtons[1].click();
    await sleep(500);
  }

  // Expand first agent prompt to show editable textarea
  console.log('Expanding agent prompt (editable)...');
  await page.evaluate(() => {
    const el = document.querySelector('.setup-agent-prompts');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(300);

  const promptToggles = await page.$$('.setup-prompt-toggle');
  if (promptToggles.length > 0) {
    await promptToggles[0].click();
    await sleep(500);
  }
  await page.screenshot({ path: `${OUT}/05-editable-agent-prompts.png`, fullPage: false });

  // Screenshot 5: Show tier grouping with multiple agents visible
  console.log('Capturing tier grouping...');
  // Scroll to show the tier labels
  await page.evaluate(() => {
    const tiers = document.querySelectorAll('.setup-tier-label');
    if (tiers.length > 1) tiers[1].scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/06-tier-grouping.png`, fullPage: false });

  // Screenshot 6: Full page scrolled view showing everything
  console.log('Capturing full page...');
  await page.screenshot({ path: `${OUT}/07-full-setup-panel.png`, fullPage: true });

  await browser.close();
  console.log('\nDone! Screenshots saved to docs/screenshots/');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
