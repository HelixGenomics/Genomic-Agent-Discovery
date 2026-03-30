/**
 * VCF (Variant Call Format) 4.x parser
 *
 * Handles both chip-array VCF and whole-genome sequencing VCF files.
 *
 * File format:
 *   ##fileformat=VCFv4.x
 *   ##... metadata lines
 *   ##reference=file:///path/to/GRCh37.fasta
 *   #CHROM  POS  ID  REF  ALT  QUAL  FILTER  INFO  FORMAT  SAMPLE1
 *   1  12345  rs12345  A  G  .  PASS  .  GT  0/1
 *
 * GT field values:
 *   0/0 = homozygous reference
 *   0/1 = heterozygous
 *   1/1 = homozygous alternate
 *   1/2 = heterozygous with two different alternates (multi-allelic)
 *   ./. = no-call
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const VALID_CHROMOSOMES = new Set([
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','X','Y','MT',
]);

// Map common VCF chromosome names to our normalized form
const CHROMOSOME_MAP = {
  'chr1': '1', 'chr2': '2', 'chr3': '3', 'chr4': '4', 'chr5': '5',
  'chr6': '6', 'chr7': '7', 'chr8': '8', 'chr9': '9', 'chr10': '10',
  'chr11': '11', 'chr12': '12', 'chr13': '13', 'chr14': '14', 'chr15': '15',
  'chr16': '16', 'chr17': '17', 'chr18': '18', 'chr19': '19', 'chr20': '20',
  'chr21': '21', 'chr22': '22', 'chrx': 'X', 'chry': 'Y',
  'chrm': 'MT', 'chrmt': 'MT', 'mt': 'MT', 'm': 'MT',
};

/**
 * Detect genome build from VCF metadata lines.
 */
function detectBuild(metadataLines) {
  for (const line of metadataLines) {
    const lower = line.toLowerCase();
    if (lower.includes('grch38') || lower.includes('hg38') || lower.includes('build 38')) {
      return 'GRCh38';
    }
    if (lower.includes('grch37') || lower.includes('hg19') || lower.includes('build 37')) {
      return 'GRCh37';
    }
    if (lower.includes('ncbi36') || lower.includes('hg18') || lower.includes('build 36')) {
      return 'NCBI36';
    }
  }
  return null;
}

/**
 * Detect VCF version from the fileformat line.
 */
function detectVcfVersion(metadataLines) {
  for (const line of metadataLines) {
    const match = line.match(/##fileformat=VCFv(\d+\.\d+)/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Normalize a chromosome name.
 */
function normalizeChromosome(chr) {
  const lower = chr.toLowerCase().trim();
  if (CHROMOSOME_MAP[lower]) return CHROMOSOME_MAP[lower];
  // Try stripping 'chr' prefix
  const stripped = lower.replace(/^chr/, '').toUpperCase();
  if (VALID_CHROMOSOMES.has(stripped)) return stripped;
  return null;
}

/**
 * Resolve a GT allele index to the actual allele string.
 *
 * @param {number} index - Allele index (0 = REF, 1+ = ALT).
 * @param {string} ref - Reference allele.
 * @param {string[]} alts - Alternate allele array.
 * @returns {string|null} The allele string, or null for missing.
 */
function resolveAllele(index, ref, alts) {
  if (index === 0) return ref;
  if (index > 0 && index <= alts.length) return alts[index - 1];
  return null;
}

/**
 * Convert resolved alleles into a genotype string suitable for SNP analysis.
 * For simple SNPs (single base REF and ALT), returns two-character genotype like "AG".
 * For indels and complex variants, returns the full allele representation.
 */
function buildGenotype(allele1, allele2) {
  if (!allele1 || !allele2) return null;
  if (allele1 === '.' || allele2 === '.') return null;

  // For simple SNPs, concatenate the bases
  if (allele1.length === 1 && allele2.length === 1) {
    return allele1.toUpperCase() + allele2.toUpperCase();
  }

  // For indels/complex variants, use a more descriptive format
  // Keep the alleles as-is for downstream analysis
  return allele1.toUpperCase() + '/' + allele2.toUpperCase();
}

/**
 * Parse a VCF file.
 *
 * @param {string} filePath - Absolute path to the VCF file.
 * @param {object} [options] - Parsing options.
 * @param {boolean} [options.skipMT=false] - Skip mitochondrial variants.
 * @param {boolean} [options.skipY=false] - Skip Y chromosome variants.
 * @param {boolean} [options.rsidOnly=true] - Only include variants with rs IDs.
 * @param {number} [options.sampleIndex=0] - Which sample column to use (0-based, relative to FORMAT).
 * @param {function} [options.onProgress] - Callback(lineCount) for progress updates.
 * @returns {Promise<{genotypes: Map, metadataLines: string[], vcfVersion: string|null, build: string|null, noCallCount: number, totalCount: number, sampleName: string|null}>}
 */
export async function parseVcf(filePath, options = {}) {
  const {
    skipMT = false,
    skipY = false,
    rsidOnly = true,
    sampleIndex = 0,
    onProgress,
  } = options;

  const genotypes = new Map();
  const metadataLines = [];
  let totalCount = 0;
  let noCallCount = 0;
  let lineNumber = 0;
  let sampleName = null;
  let headerColumns = null;
  let formatColumnIndex = -1;
  let sampleColumnIndex = -1;
  const progressInterval = 100000;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    // Collect metadata lines (##...)
    if (line.startsWith('##')) {
      metadataLines.push(line);
      continue;
    }

    // Parse header line (#CHROM ...)
    if (line.startsWith('#CHROM') || line.startsWith('#chrom')) {
      headerColumns = line.substring(1).split('\t');
      formatColumnIndex = headerColumns.findIndex(
        col => col.toUpperCase() === 'FORMAT'
      );

      // Sample columns come after FORMAT
      if (formatColumnIndex >= 0 && headerColumns.length > formatColumnIndex + 1 + sampleIndex) {
        sampleColumnIndex = formatColumnIndex + 1 + sampleIndex;
        sampleName = headerColumns[sampleColumnIndex];
      } else if (formatColumnIndex >= 0 && headerColumns.length > formatColumnIndex + 1) {
        // Fall back to first sample if requested index doesn't exist
        sampleColumnIndex = formatColumnIndex + 1;
        sampleName = headerColumns[sampleColumnIndex];
      } else {
        throw new Error(
          `VCF parser: No sample column found in header. ` +
          `Expected FORMAT and at least one sample column. ` +
          `Header columns: ${headerColumns.join(', ')}`
        );
      }
      continue;
    }

    // Require that we've parsed the header before processing data lines
    if (!headerColumns) {
      continue; // Skip lines before header (shouldn't happen in valid VCF)
    }

    // Parse data line
    const fields = line.split('\t');
    if (fields.length <= sampleColumnIndex) continue;

    const chromRaw = fields[0];
    const pos = parseInt(fields[1], 10);
    const id = fields[2]; // rsID or '.'
    const ref = fields[3];
    const altField = fields[4];
    const format = fields[formatColumnIndex];
    const sampleData = fields[sampleColumnIndex];

    // Normalize chromosome
    const chromosome = normalizeChromosome(chromRaw);
    if (!chromosome) continue;

    // Apply chromosome filters
    if (skipMT && chromosome === 'MT') continue;
    if (skipY && chromosome === 'Y') continue;

    // Skip variants without rsID if rsidOnly is set
    if (rsidOnly && (!id || id === '.' || !id.startsWith('rs'))) continue;

    // Validate position
    if (isNaN(pos) || pos <= 0) continue;

    // Parse the FORMAT field to find GT index
    const formatFields = format.split(':');
    const gtIndex = formatFields.indexOf('GT');
    if (gtIndex < 0) continue; // No genotype field

    // Parse sample data to get GT value
    const sampleFields = sampleData.split(':');
    if (sampleFields.length <= gtIndex) continue;

    const gtRaw = sampleFields[gtIndex];

    // Parse GT: "0/0", "0/1", "1/1", "1/2", "./.", "0|1", etc.
    // Separator can be '/' (unphased) or '|' (phased)
    const gtParts = gtRaw.split(/[/|]/);
    if (gtParts.length < 2) {
      // Haploid call (e.g., chrX in males): single allele
      if (gtParts.length === 1 && gtParts[0] !== '.') {
        const alleleIdx = parseInt(gtParts[0], 10);
        const alts = altField === '.' ? [] : altField.split(',');
        const allele = resolveAllele(alleleIdx, ref, alts);
        if (allele) {
          totalCount++;
          const rsid = id.startsWith('rs') ? id : `${chromosome}:${pos}`;
          genotypes.set(rsid, {
            rsid,
            chromosome,
            position: pos,
            genotype: allele.toUpperCase(),
          });
        }
        continue;
      }
      continue;
    }

    const alts = altField === '.' ? [] : altField.split(',');

    // Check for no-call
    if (gtParts[0] === '.' || gtParts[1] === '.') {
      totalCount++;
      noCallCount++;
      const rsid = id.startsWith('rs') ? id : `${chromosome}:${pos}`;
      genotypes.set(rsid, {
        rsid,
        chromosome,
        position: pos,
        genotype: '--',
      });
      continue;
    }

    const alleleIndex1 = parseInt(gtParts[0], 10);
    const alleleIndex2 = parseInt(gtParts[1], 10);

    if (isNaN(alleleIndex1) || isNaN(alleleIndex2)) continue;

    const allele1 = resolveAllele(alleleIndex1, ref, alts);
    const allele2 = resolveAllele(alleleIndex2, ref, alts);

    const genotype = buildGenotype(allele1, allele2);

    totalCount++;

    if (genotype === null) {
      noCallCount++;
      const rsid = id.startsWith('rs') ? id : `${chromosome}:${pos}`;
      genotypes.set(rsid, {
        rsid,
        chromosome,
        position: pos,
        genotype: '--',
      });
    } else {
      const rsid = id.startsWith('rs') ? id : `${chromosome}:${pos}`;
      genotypes.set(rsid, {
        rsid,
        chromosome,
        position: pos,
        genotype,
      });
    }

    if (onProgress && lineNumber % progressInterval === 0) {
      onProgress(lineNumber);
    }
  }

  const vcfVersion = detectVcfVersion(metadataLines);
  const build = detectBuild(metadataLines);

  if (totalCount === 0) {
    throw new Error(
      `VCF parser: No valid genotype records found in ${filePath}. ` +
      `Read ${lineNumber} lines total, ${metadataLines.length} metadata lines. ` +
      (rsidOnly ? 'Note: rsidOnly=true filters out variants without rs IDs.' : '')
    );
  }

  return {
    genotypes,
    metadataLines,
    vcfVersion,
    build,
    noCallCount,
    totalCount,
    sampleName,
  };
}
