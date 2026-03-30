/**
 * MyHeritage DNA raw data parser
 *
 * File format (CSV):
 *   RSID,CHROMOSOME,POSITION,RESULT
 *   "rs12345","1","12345","AG"
 *
 * Fields may or may not be quoted. RESULT is the genotype string directly.
 * No-call is typically "--" or empty.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const VALID_CHROMOSOMES = new Set([
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','X','Y','MT',
]);

/**
 * Strip surrounding quotes from a CSV field.
 */
function unquote(field) {
  if (!field) return '';
  const trimmed = field.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Split a CSV line, respecting quoted fields.
 * Handles both simple comma separation and quoted fields with embedded commas.
 */
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Normalize genotype value.
 */
function normalizeGenotype(raw) {
  if (!raw || raw === '--' || raw === '..' || raw === '0' || raw === '00') return null;
  return raw.toUpperCase();
}

/**
 * Parse a MyHeritage raw data file.
 *
 * @param {string} filePath - Absolute path to the raw data file.
 * @param {object} [options] - Parsing options.
 * @param {boolean} [options.skipMT=false] - Skip mitochondrial variants.
 * @param {boolean} [options.skipY=false] - Skip Y chromosome variants.
 * @param {function} [options.onProgress] - Callback(lineCount) for progress updates.
 * @returns {Promise<{genotypes: Map, headerLines: string[], build: string|null, noCallCount: number, totalCount: number}>}
 */
export async function parseMyHeritage(filePath, options = {}) {
  const { skipMT = false, skipY = false, onProgress } = options;

  const genotypes = new Map();
  const headerLines = [];
  let totalCount = 0;
  let noCallCount = 0;
  let lineNumber = 0;
  let hasHeaderRow = false;
  const progressInterval = 100000;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    // Comment lines (MyHeritage sometimes includes these)
    if (line.startsWith('#')) {
      headerLines.push(line);
      continue;
    }

    // Detect header row: RSID,CHROMOSOME,POSITION,RESULT
    const lower = line.toLowerCase().replace(/"/g, '');
    if (lower.startsWith('rsid') && lower.includes('chromosome') && lower.includes('result')) {
      hasHeaderRow = true;
      headerLines.push(line);
      continue;
    }

    // Parse CSV data line
    const parts = splitCsvLine(line);
    if (parts.length < 4) continue;

    const rsid = unquote(parts[0]);
    const chromosome = unquote(parts[1]).toUpperCase().replace('CHR', '');
    const position = parseInt(unquote(parts[2]), 10);
    const rawGenotype = unquote(parts[3]);

    // Validate chromosome
    if (!VALID_CHROMOSOMES.has(chromosome)) continue;

    // Apply chromosome filters
    if (skipMT && chromosome === 'MT') continue;
    if (skipY && chromosome === 'Y') continue;

    // Validate position
    if (isNaN(position) || position <= 0) continue;

    // Validate rsid
    if (!rsid) continue;

    totalCount++;

    const genotype = normalizeGenotype(rawGenotype);
    if (genotype === null) {
      noCallCount++;
      genotypes.set(rsid, {
        rsid,
        chromosome,
        position,
        genotype: '--',
      });
    } else {
      genotypes.set(rsid, {
        rsid,
        chromosome,
        position,
        genotype,
      });
    }

    if (onProgress && lineNumber % progressInterval === 0) {
      onProgress(lineNumber);
    }
  }

  if (totalCount === 0) {
    throw new Error(
      `MyHeritage parser: No valid genotype lines found in ${filePath}. ` +
      `Read ${lineNumber} lines total.`
    );
  }

  return {
    genotypes,
    headerLines,
    build: 'GRCh37', // MyHeritage uses GRCh37
    noCallCount,
    totalCount,
    hasHeaderRow,
  };
}
