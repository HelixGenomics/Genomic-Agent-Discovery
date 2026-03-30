/**
 * Genotype database builder
 *
 * Creates a per-run SQLite database from parsed genotype data using better-sqlite3.
 * Uses transactions and prepared statements for fast bulk inserts.
 */

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, 'schema.sql');

/**
 * Create a genotype database from parsed DNA data.
 *
 * @param {string} stateDir - Directory for this job's state (e.g., state/{jobId}/).
 * @param {object} parsedData - Output from parseDnaFile().
 * @param {Map} parsedData.genotypes - Map of rsid -> {rsid, chromosome, position, genotype}.
 * @param {string} parsedData.format - Detected format name.
 * @param {string|null} parsedData.version - Chip/format version.
 * @param {number} parsedData.count - Total genotype count.
 * @param {number} parsedData.noCallRate - No-call rate (0-1).
 * @param {object} parsedData.metadata - Metadata from parsing.
 * @param {object} [options] - Options.
 * @param {function} [options.onProgress] - Progress callback(insertedCount).
 * @returns {string} Path to the created database file.
 */
export function createGenotypeDb(stateDir, parsedData, options = {}) {
  const { onProgress } = options;

  // Ensure the state directory exists
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const dbPath = join(stateDir, 'genotypes.db');

  // Read and execute the schema
  let schemaSql;
  try {
    schemaSql = readFileSync(SCHEMA_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read schema file at ${SCHEMA_PATH}: ${err.message}`);
  }

  // Create the database
  const db = new Database(dbPath);

  try {
    // Performance settings for bulk inserts
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');

    // Execute schema (creates tables and indexes)
    db.exec(schemaSql);

    // Prepare the insert statement
    const insertStmt = db.prepare(
      'INSERT OR REPLACE INTO genotypes (rsid, chromosome, position, genotype) VALUES (?, ?, ?, ?)'
    );

    // Bulk insert inside a transaction for speed
    const batchSize = 50000;
    let insertedCount = 0;
    let batch = [];

    const flushBatch = db.transaction((rows) => {
      for (const row of rows) {
        insertStmt.run(row.rsid, row.chromosome, row.position, row.genotype);
      }
    });

    const startTime = Date.now();

    for (const [, entry] of parsedData.genotypes) {
      batch.push(entry);

      if (batch.length >= batchSize) {
        flushBatch(batch);
        insertedCount += batch.length;
        batch = [];

        if (onProgress) {
          onProgress(insertedCount);
        }
      }
    }

    // Flush remaining rows
    if (batch.length > 0) {
      flushBatch(batch);
      insertedCount += batch.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Store metadata
    const insertMeta = db.prepare(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)'
    );

    const metaTransaction = db.transaction(() => {
      insertMeta.run('format', parsedData.format);
      insertMeta.run('version', parsedData.version || '');
      insertMeta.run('count', String(parsedData.count));
      insertMeta.run('no_call_rate', String(parsedData.noCallRate));
      insertMeta.run('build', parsedData.metadata?.build || '');
      insertMeta.run('file_name', parsedData.metadata?.fileName || '');
      insertMeta.run('sample_name', parsedData.metadata?.sampleName || '');
      insertMeta.run('created_at', new Date().toISOString());
      insertMeta.run('insert_time_seconds', elapsed);
    });

    metaTransaction();

    // Run ANALYZE so SQLite can optimize queries
    db.exec('ANALYZE');

    console.log(
      `[genotype-db] Inserted ${insertedCount.toLocaleString()} genotypes into ${dbPath} in ${elapsed}s`
    );

    return dbPath;
  } finally {
    db.close();
  }
}
