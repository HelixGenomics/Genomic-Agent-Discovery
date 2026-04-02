#!/usr/bin/env node

/**
 * Generate a clinical-grade PDF report from narrator markdown output.
 *
 * Usage:
 *   node scripts/generate-report-pdf.mjs <path-to-narrator.md> [output.pdf]
 *   npm run generate-pdf -- <path-to-narrator.md>
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Parse CLI args ──
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/generate-report-pdf.mjs <narrator.md> [output.pdf]');
  console.error('Example: npm run generate-pdf -- MD_DOCS/narrator.md');
  process.exit(1);
}

const resolvedInput = resolve(inputPath);
if (!existsSync(resolvedInput)) {
  console.error(`File not found: ${resolvedInput}`);
  process.exit(1);
}

const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolvedInput.replace(/\.md$/i, '.pdf');

console.log(`Reading: ${resolvedInput}`);
console.log(`Output:  ${outputPath}`);

// ── Read input ──
const rawMarkdown = readFileSync(resolvedInput, 'utf-8');

// ── Extract metadata from markdown ──
function extractMetadata(md) {
  const meta = {
    title: 'Genomic Analysis Report',
    subtitle: '',
    reportId: `HGX-${Date.now().toString(36).toUpperCase()}`,
    date: new Date().toISOString().split('T')[0],
    platform: 'Genomic Agent Discovery Pipeline',
    pipeline: 'Multi-Agent AI Analysis',
  };

  // Try to extract title from first # heading
  const titleMatch = md.match(/^#\s+(.+?)$/m);
  if (titleMatch) {
    meta.title = titleMatch[1]
      .replace(/\*\*/g, '')
      .replace(/[_*]/g, '')
      .trim();
  }

  // Try subtitle from ## after the title
  const subtitleMatch = md.match(/^##\s+(?!SECTION)(.+?)$/m);
  if (subtitleMatch) {
    meta.subtitle = subtitleMatch[1]
      .replace(/\*\*/g, '')
      .replace(/[_*]/g, '')
      .trim();
  }

  // Extract subject/classification lines
  const classMatch = md.match(/\*\*Report Classification:\*\*\s*(.+)/);
  if (classMatch) meta.subtitle = classMatch[1].trim();

  // Keep platform/pipeline short for the specimen box
  const frameworkMatch = md.match(/\*\*Analysis Framework:\*\*\s*(.+)/);
  if (frameworkMatch) {
    // Truncate to first phrase for the box
    const fw = frameworkMatch[1].trim();
    meta.platform = fw.length > 50 ? fw.split('—')[0].trim() : fw;
  }

  const subjectMatch = md.match(/\*\*Subject:\*\*\s*(.+)/);
  if (subjectMatch) {
    const subj = subjectMatch[1].trim();
    meta.pipeline = subj.length > 50 ? subj.split('(')[0].trim() : subj;
  }

  return meta;
}

// ── Strip narrator preamble and header metadata ──
function stripPreamble(md) {
  // 1. Strip thinking text before the first --- that precedes the # title
  const firstHrIdx = md.indexOf('\n---\n');
  const firstH1Idx = md.indexOf('\n# ');
  if (firstHrIdx !== -1 && firstH1Idx !== -1 && firstHrIdx < firstH1Idx) {
    md = md.substring(firstHrIdx + 5);
  }

  // 2. Strip the header block (# title, ## subtitle, metadata lines, ---)
  //    since this info is already on the cover page
  const lines = md.split('\n');
  let contentStart = 0;
  let passedTitle = false;
  let passedFirstHr = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) { passedTitle = true; continue; }
    if (passedTitle && !passedFirstHr) {
      // Skip subtitle, metadata lines, and the --- separator after them
      if (line === '---') { passedFirstHr = true; contentStart = i + 1; continue; }
      if (line === '' || line.startsWith('## ') || line.startsWith('**')) continue;
    }
    if (passedFirstHr) { contentStart = i; break; }
  }

  if (passedFirstHr) {
    md = lines.slice(contentStart).join('\n');
  }

  return md;
}

// ── Split markdown into sections ──
function splitSections(md) {
  md = stripPreamble(md);
  const lines = md.split('\n');
  const sections = [];
  let current = null;
  let preamble = [];
  let inPreamble = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect major section headers: ## SECTION N: TITLE or ## APPENDIX
    const sectionMatch = line.match(/^##\s+(?:SECTION\s+\d+:\s*)?(.+)/);

    if (sectionMatch && !line.match(/^##\s+[A-Z][a-z].*Debendox/)) {
      // Check if this is a banner-worthy section (all caps or starts with SECTION)
      const isBanner = /^##\s+SECTION\s+\d+/i.test(line) ||
                        /^##\s+APPENDIX/i.test(line) ||
                        /^##\s+[A-Z\s&:]+$/.test(line.trim());

      if (inPreamble && preamble.length > 0) {
        // Save preamble as a section
        sections.push({ title: null, banner: false, content: preamble.join('\n') });
        preamble = [];
      }
      inPreamble = false;

      if (current) sections.push(current);
      current = {
        title: sectionMatch[1].trim(),
        banner: isBanner,
        content: ''
      };
    } else if (inPreamble) {
      // Skip the main title and subtitle lines
      if (line.match(/^#\s+/) || line.match(/^\*\*(Report Classification|Subject|Analysis Framework|Date|Prepared by):/)) {
        continue;
      }
      preamble.push(line);
    } else if (current) {
      current.content += line + '\n';
    }
  }

  if (current) sections.push(current);
  return sections;
}

// ── Configure marked ──
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer to enhance output
const renderer = new marked.Renderer();

// Detect "KEY TAKEAWAYS" patterns and render as styled boxes
function processKeyTakeaways(html) {
  // Pattern: bold "Key Takeaways" or similar followed by numbered list
  // Look for patterns like **Key finding:** or numbered bold items after a takeaway header
  return html;
}

// ── Convert section content to styled HTML ──
function renderSection(section) {
  let content = section.content || '';

  // Process "Key Takeaways" blocks
  // These appear as bold text blocks at the start of subsections
  content = processKeyTakeawaysInMd(content);

  // Convert markdown to HTML
  let html = marked.parse(content);

  // Post-process: wrap KEY TAKEAWAYS markers
  html = html.replace(
    /<p>:::KEY_TAKEAWAYS_START:::<\/p>([\s\S]*?)<p>:::KEY_TAKEAWAYS_END:::<\/p>/g,
    (_, inner) => {
      const items = [];
      const itemRegex = /<li>([\s\S]*?)<\/li>/g;
      let match;
      while ((match = itemRegex.exec(inner)) !== null) {
        items.push(match[1].trim());
      }
      if (items.length === 0) return inner;

      const itemsHtml = items.map((text, i) =>
        `<div class="key-takeaway-item">
          <span class="key-takeaway-num">${i + 1}</span>
          <span class="key-takeaway-text">${text}</span>
        </div>`
      ).join('\n');

      return `<div class="key-takeaways">
        <div class="key-takeaways-title">KEY TAKEAWAYS</div>
        ${itemsHtml}
      </div>`;
    }
  );

  return html;
}

function processKeyTakeawaysInMd(md) {
  // Find patterns like:
  // **Key Takeaways:**
  // 1. Item one
  // 2. Item two
  //
  // Or bold numbered items that look like takeaways
  const lines = md.split('\n');
  const result = [];
  let inTakeaway = false;
  let takeawayItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect takeaway headers
    if (/^\*\*Key\s+Takeaways?\*\*/i.test(trimmed) ||
        /^Key\s+Takeaways?:/i.test(trimmed) ||
        /^\*\*KEY\s+TAKEAWAYS?\*\*/i.test(trimmed)) {
      inTakeaway = true;
      takeawayItems = [];
      result.push(':::KEY_TAKEAWAYS_START:::');
      result.push('');
      continue;
    }

    if (inTakeaway) {
      // Numbered items
      if (/^\d+\.\s+/.test(trimmed)) {
        takeawayItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      } else if (/^[-*]\s+/.test(trimmed)) {
        takeawayItems.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (trimmed === '' && takeawayItems.length > 0) {
        // End of takeaways block
        result.push('<ol>');
        for (const item of takeawayItems) {
          result.push(`<li>${item}</li>`);
        }
        result.push('</ol>');
        result.push('');
        result.push(':::KEY_TAKEAWAYS_END:::');
        result.push('');
        inTakeaway = false;
        takeawayItems = [];
      } else if (trimmed !== '') {
        // Could be continuation of previous item or a non-list takeaway
        if (takeawayItems.length > 0) {
          takeawayItems[takeawayItems.length - 1] += ' ' + trimmed;
        } else {
          // Not actually a list-based takeaway block, revert
          result.push(':::KEY_TAKEAWAYS_END:::');
          result.push(line);
          inTakeaway = false;
        }
      }
    } else {
      result.push(line);
    }
  }

  // Close any open takeaway block
  if (inTakeaway && takeawayItems.length > 0) {
    result.push('<ol>');
    for (const item of takeawayItems) {
      result.push(`<li>${item}</li>`);
    }
    result.push('</ol>');
    result.push('');
    result.push(':::KEY_TAKEAWAYS_END:::');
  }

  return result.join('\n');
}

// ── Build full HTML ──
function buildHtml(meta, sections) {
  const template = readFileSync(resolve(PROJECT_ROOT, 'src/report-template.html'), 'utf-8');

  // Build content sections
  let contentHtml = '';
  let sectionNum = 0;

  for (const section of sections) {
    // Page break before each major section (except first)
    if (section.banner && sectionNum > 0) {
      contentHtml += '<div class="page-break"></div>\n';
    }

    contentHtml += '<div class="page">\n';

    // Page header
    contentHtml += '<div class="page-header-bar"></div>\n';
    contentHtml += `<div class="page-header">
      <div class="page-header-left">HELIX GENOMICS <span>&nbsp;|&nbsp; ${truncate(meta.title, 40)}</span></div>
      <div class="page-header-right">${meta.reportId} &nbsp;|&nbsp; ${meta.date}</div>
    </div>\n`;

    // Section banner
    if (section.banner && section.title) {
      const displayTitle = section.title.replace(/^SECTION\s+\d+:\s*/i, '');
      sectionNum++;
      contentHtml += `<div class="section-banner">${sectionNum}. ${displayTitle}</div>\n`;
    } else if (section.title) {
      contentHtml += `<h2>${section.title}</h2>\n`;
    }

    // Section content
    contentHtml += renderSection(section);
    contentHtml += '</div>\n';
  }

  // Inject into template
  let html = template
    .replace(/\{\{REPORT_TITLE\}\}/g, meta.title)
    .replace(/\{\{REPORT_SUBTITLE\}\}/g, meta.subtitle)
    .replace(/\{\{REPORT_ID\}\}/g, meta.reportId)
    .replace(/\{\{REPORT_DATE\}\}/g, meta.date)
    .replace(/\{\{PLATFORM\}\}/g, meta.platform)
    .replace(/\{\{PIPELINE\}\}/g, meta.pipeline)
    .replace('{{CONTENT}}', contentHtml);

  return html;
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '...' : str;
}

// ── Render PDF with Puppeteer ──
async function renderPdf(html, outPath) {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('Puppeteer is required. Install with: npm install puppeteer');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set content
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Generate PDF
  console.log('Generating PDF...');
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '65px', left: '0' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="width: 100%; padding: 0 75px; font-size: 8px; color: #999; display: flex; justify-content: space-between; align-items: center;">
        <span style="flex: 1;">This report is for informational purposes only. Not a medical diagnosis. Consult a healthcare professional.</span>
        <span style="margin-left: 20px;">helixsequencing.com</span>
        <span style="margin-left: 40px;">Page <span class="pageNumber"></span></span>
      </div>
    `,
  });

  await browser.close();
  console.log(`PDF saved: ${outPath}`);
}

// ── Main ──
const meta = extractMetadata(rawMarkdown);
const sections = splitSections(rawMarkdown);

console.log(`Title: ${meta.title}`);
console.log(`Sections: ${sections.length}`);

const html = buildHtml(meta, sections);

// Also save the intermediate HTML for debugging
const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
writeFileSync(htmlPath, html);
console.log(`HTML saved: ${htmlPath}`);

await renderPdf(html, outputPath);
console.log('Done!');
