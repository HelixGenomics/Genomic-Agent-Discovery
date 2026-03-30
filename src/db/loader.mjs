/**
 * Database connection manager
 *
 * Opens a genotype SQLite database in readonly mode,
 * verifies the schema, and provides a handle for queries.
 */

import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Required tables and their expected columns.
 */
const REQUIRED_TABLES = {
  genotypes: ['rsid', 'chromosome', 'position', 'genotype'],
  metadata: ['key', 'value'],
};

/**
 * Open a genotype database for reading.
 *
 * @param {string} dbPath - Path to the genotypes.db file.
 * @param {object} [options] - Options.
 * @param {boolean} [options.readonly=true] - Open in readonly mode.
 * @param {boolean} [options.verify=true] - Verify schema on open.
 * @returns {Database} The better-sqlite3 database handle.
 * @throws {Error} If the file doesn't exist or the schema is invalid.
 */
export function openDatabase(dbPath, options = {}) {
  const { readonly = true, verify = true } = options;

  if (!existsSync(dbPath)) {
    throw new Error(`Genotype database not found: ${dbPath}`);
  }

  const db = new Database(dbPath, { readonly });

  // Performance settings for reads
  db.pragma('cache_size = -32000'); // 32MB cache
  db.pragma('temp_store = MEMORY');

  if (verify) {
    verifySchema(db, dbPath);
  }

  return db;
}

/**
 * Verify that the database has the expected tables and columns.
 *
 * @param {Database} db - The database handle.
 * @param {string} dbPath - Path for error messages.
 * @throws {Error} If any required table or column is missing.
 */
function verifySchema(db, dbPath) {
  // Get list of tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map(row => row.name);

  for (const [tableName, expectedColumns] of Object.entries(REQUIRED_TABLES)) {
    if (!tables.includes(tableName)) {
      throw new Error(
        `Genotype database at ${dbPath} is missing required table "${tableName}". ` +
        `Found tables: ${tables.join(', ') || '(none)'}. ` +
        `The database may be corrupted or was created with an incompatible version.`
      );
    }

    // Check columns
    const columns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map(row => row.name);

    for (const col of expectedColumns) {
      if (!columns.includes(col)) {
        throw new Error(
          `Table "${tableName}" in ${dbPath} is missing required column "${col}". ` +
          `Found columns: ${columns.join(', ')}. ` +
          `The database may need to be rebuilt.`
        );
      }
    }
  }
}

/**
 * Get metadata from the database.
 *
 * @param {Database} db - The database handle.
 * @returns {object} Key-value pairs from the metadata table.
 */
export function getMetadata(db) {
  const rows = db.prepare('SELECT key, value FROM metadata').all();
  const meta = {};
  for (const row of rows) {
    meta[row.key] = row.value;
  }
  return meta;
}

/**
 * Look up a single genotype by rsID.
 *
 * @param {Database} db - The database handle.
 * @param {string} rsid - The rs identifier (e.g., "rs1234").
 * @returns {{rsid: string, chromosome: string, position: number, genotype: string}|null}
 */
export function lookupGenotype(db, rsid) {
  return db
    .prepare('SELECT rsid, chromosome, position, genotype FROM genotypes WHERE rsid = ?')
    .get(rsid) || null;
}

/**
 * Look up multiple genotypes by rsID.
 *
 * @param {Database} db - The database handle.
 * @param {string[]} rsids - Array of rs identifiers.
 * @returns {Map<string, {rsid: string, chromosome: string, position: number, genotype: string}>}
 */
export function lookupGenotypes(db, rsids) {
  const results = new Map();
  if (!rsids || rsids.length === 0) return results;

  // Use a prepared statement in a loop for best performance with better-sqlite3
  const stmt = db.prepare(
    'SELECT rsid, chromosome, position, genotype FROM genotypes WHERE rsid = ?'
  );

  for (const rsid of rsids) {
    const row = stmt.get(rsid);
    if (row) {
      results.set(rsid, row);
    }
  }

  return results;
}

/**
 * Query genotypes by chromosome region.
 *
 * @param {Database} db - The database handle.
 * @param {string} chromosome - Chromosome (e.g., "1", "X").
 * @param {number} [startPos] - Start position (inclusive). Omit for whole chromosome.
 * @param {number} [endPos] - End position (inclusive). Omit for whole chromosome.
 * @returns {Array<{rsid: string, chromosome: string, position: number, genotype: string}>}
 */
export function queryRegion(db, chromosome, startPos, endPos) {
  if (startPos !== undefined && endPos !== undefined) {
    return db
      .prepare(
        'SELECT rsid, chromosome, position, genotype FROM genotypes ' +
        'WHERE chromosome = ? AND position >= ? AND position <= ? ' +
        'ORDER BY position'
      )
      .all(chromosome, startPos, endPos);
  }

  return db
    .prepare(
      'SELECT rsid, chromosome, position, genotype FROM genotypes ' +
      'WHERE chromosome = ? ORDER BY position'
    )
    .all(chromosome);
}

/**
 * Get a summary of the genotype database contents.
 *
 * @param {Database} db - The database handle.
 * @returns {{totalVariants: number, chromosomeCounts: object, noCallCount: number}}
 */
export function getSummary(db) {
  const total = db.prepare('SELECT COUNT(*) as count FROM genotypes').get();
  const noCalls = db
    .prepare("SELECT COUNT(*) as count FROM genotypes WHERE genotype = '--'")
    .get();

  const chrRows = db
    .prepare(
      'SELECT chromosome, COUNT(*) as count FROM genotypes GROUP BY chromosome ORDER BY ' +
      "CASE WHEN chromosome GLOB '[0-9]*' THEN CAST(chromosome AS INTEGER) " +
      "WHEN chromosome = 'X' THEN 23 " +
      "WHEN chromosome = 'Y' THEN 24 " +
      "WHEN chromosome = 'MT' THEN 25 " +
      'ELSE 26 END'
    )
    .all();

  const chromosomeCounts = {};
  for (const row of chrRows) {
    chromosomeCounts[row.chromosome] = row.count;
  }

  return {
    totalVariants: total.count,
    noCallCount: noCalls.count,
    chromosomeCounts,
  };
}
