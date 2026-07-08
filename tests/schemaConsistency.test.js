// ============================================================
// Schema Consistency Check
// ------------------------------------------------------------
// This does NOT replace running against a real Postgres instance.
// What it DOES do: statically parses db/migrations/001_init.sql
// for each table's actual column names, then scans every
// repository file for INSERT/UPDATE column references and flags
// any that don't exist in the schema. This catches typos and
// drift between the SQL and the schema without needing a live DB.
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function parseSchemaColumns(sql) {
  const tables = {};
  const tableBlockRe = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let match;
  while ((match = tableBlockRe.exec(sql))) {
    const [, tableName, body] = match;
    const columns = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line) continue;
      const firstWord = line.split(/\s+/)[0].toUpperCase();
      if (['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'CHECK', 'FOREIGN'].includes(firstWord)) continue;
      // A column line looks like: "  name  TYPE ...constraints" — first token is the column name
      const colName = line.split(/\s+/)[0].replace(/"/g, '');
      if (/^[a-z_][a-z0-9_]*$/i.test(colName)) columns.push(colName.toLowerCase());
    }
    tables[tableName.toLowerCase()] = new Set(columns);
  }
  return tables;
}

function extractInsertReferences(sql) {
  // Matches: INSERT INTO table_name (col1, col2, ...)
  const results = [];
  const re = /INSERT INTO\s+(\w+)\s*\(([^)]+)\)/gi;
  let match;
  while ((match = re.exec(sql))) {
    const table = match[1].toLowerCase();
    const cols = match[2].split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    results.push({ table, cols });
  }
  return results;
}

function extractUpdateSetReferences(sql) {
  // Matches: UPDATE table_name SET col1 = ..., col2 = ...  (stops at WHERE/RETURNING)
  const results = [];
  const re = /UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)(WHERE|RETURNING|$)/gi;
  let match;
  while ((match = re.exec(sql))) {
    const table = match[1].toLowerCase();
    const setClause = match[2];
    const cols = [...setClause.matchAll(/(\w+)\s*=/g)].map(m => m[1].toLowerCase());
    results.push({ table, cols });
  }
  return results;
}

const schemaPath = path.join(__dirname, '..', 'db', 'migrations', '001_init.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const schemaTables = parseSchemaColumns(schemaSql);

const repoDir = path.join(__dirname, '..', 'db', 'repositories');
const repoFiles = fs.readdirSync(repoDir).filter(f => f.endsWith('.js'));

test('every schema table parsed has at least one column (parser sanity check)', () => {
  const tableNames = Object.keys(schemaTables);
  assert.ok(tableNames.includes('leads'), 'expected "leads" table to be found in schema');
  assert.ok(tableNames.includes('clients'), 'expected "clients" table to be found in schema');
  assert.ok(tableNames.includes('otp_verifications'), 'expected "otp_verifications" table to be found in schema');
  assert.ok(tableNames.includes('revoked_tokens'), 'expected "revoked_tokens" table to be found in schema');
  for (const [name, cols] of Object.entries(schemaTables)) {
    assert.ok(cols.size > 0, `table ${name} should have parsed at least one column`);
  }
});

for (const file of repoFiles) {
  test(`${file}: every INSERT column exists in its table's schema`, () => {
    const content = fs.readFileSync(path.join(repoDir, file), 'utf8');
    const inserts = extractInsertReferences(content);
    for (const { table, cols } of inserts) {
      const knownCols = schemaTables[table];
      assert.ok(knownCols, `table "${table}" referenced in ${file} was not found in schema.sql`);
      for (const col of cols) {
        assert.ok(knownCols.has(col), `column "${col}" used in INSERT INTO ${table} (in ${file}) does not exist in schema.sql`);
      }
    }
  });

  test(`${file}: every UPDATE ... SET column exists in its table's schema`, () => {
    const content = fs.readFileSync(path.join(repoDir, file), 'utf8');
    const updates = extractUpdateSetReferences(content);
    for (const { table, cols } of updates) {
      const knownCols = schemaTables[table];
      assert.ok(knownCols, `table "${table}" referenced in ${file} was not found in schema.sql`);
      for (const col of cols) {
        assert.ok(knownCols.has(col), `column "${col}" used in UPDATE ${table} SET (in ${file}) does not exist in schema.sql`);
      }
    }
  });
}
