/**
 * AncestryDNA raw data parser
 *
 * File format:
 *   #AncestryDNA raw data download
 *   #... more comment lines ...
 *   rsid \t chromosome \t position \t allele1 \t allele2
 *
 * Allele values: A, C, G, T, or 0 (no-call).
 * Two alleles are combined into a single genotype string (e.g., "A" + "G" = "AG").
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const VALID_CHROMOSOMES = new Set([
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','X','Y','MT',
]);

const VALID_ALLELES = new Set(['A', 'C', 'G', 'T']);

/**
 * Detect genome build from header comments.
 */
function detectBuild(headerLines) {
  const joined = headerLines.join('\n').toLowerCase();
  if (joined.includes('build 37') || joined.includes('grch37')) return 'GRCh37';
  if (joined.includes('build 38') || joined.includes('grch38')) return 'GRCh38';
  if (joined.includes('build 36') || joined.includes('ncbi36')) return 'NCBI36';
  return 'GRCh37'; // AncestryDNA typically uses GRCh37
}

/**
 * Combine two alleles into a genotype string.
 * Returns '--' for no-calls (when either allele is '0').
 */
function combineAlleles(allele1, allele2) {
  const a1 = allele1.toUpperCase().trim();
  const a2 = allele2.toUpperCase().trim();

  if (a1 === '0' || a2 === '0') return null;
  if (!VALID_ALLELES.has(a1) && a1 !== 'I' && a1 !== 'D') return null;
  if (!VALID_ALLELES.has(a2) && a2 !== 'I' && a2 !== 'D') return null;

  return a1 + a2;
}

/**
 * Parse an AncestryDNA raw data file.
 *
 * @param {string} filePath - Absolute path to the raw data file.
 * @param {object} [options] - Parsing options.
 * @param {boolean} [options.skipMT=false] - Skip mitochondrial variants.
 * @param {boolean} [options.skipY=false] - Skip Y chromosome variants.
 * @param {function} [options.onProgress] - Callback(lineCount) for progress updates.
 * @returns {Promise<{genotypes: Map, headerLines: string[], build: string|null, noCallCount: number, totalCount: number}>}
 */
export async function parseAncestryDna(filePath, options = {}) {
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

    // Collect comment/metadata lines
    if (line.startsWith('#')) {
      headerLines.push(line);
      continue;
    }

    // Detect and skip header row: "rsid\tchromosome\tposition\tallele1\tallele2"
    const lower = line.toLowerCase();
    if (lower.startsWith('rsid') && lower.includes('allele')) {
      hasHeaderRow = true;
      continue;
    }

    // Parse data line: rsid \t chr \t pos \t allele1 \t allele2
    const parts = line.split('\t');
    if (parts.length < 5) {
      // Try comma separation as fallback
      const commaParts = line.split(',');
      if (commaParts.length >= 5) {
        parts.length = 0;
        parts.push(...commaParts);
      } else {
        continue; // Skip malformed lines
      }
    }

    const rsid = parts[0].trim();
    const chromosome = parts[1].trim().toUpperCase().replace('CHR', '');
    const position = parseInt(parts[2].trim(), 10);
    const allele1 = parts[3].trim();
    const allele2 = parts[4].trim();

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

    const genotype = combineAlleles(allele1, allele2);
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

  const build = detectBuild(headerLines);

  if (totalCount === 0) {
    throw new Error(
      `AncestryDNA parser: No valid genotype lines found in ${filePath}. ` +
      `Read ${lineNumber} lines total, ${headerLines.length} comment lines.`
    );
  }

  return {
    genotypes,
    headerLines,
    build,
    noCallCount,
    totalCount,
    hasHeaderRow,
  };
}
