import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const sqliteFiles = readdirSync(root)
  .filter((file) => /\.(sqlite|sqlite3|db)$/i.test(file))
  .filter((file) => statSync(join(root, file)).isFile());

const hints = {
  page: [/^page$/i, /page/i, /pageno/i],
  line: [/^line$/i, /line/i, /row/i],
  text: [/text/i, /uthmani/i, /indopak/i, /arabic/i, /word/i, /ayah/i, /aya/i],
  surah: [/sura/i, /surah/i, /chapter/i],
  ayah: [/ayah/i, /\baya\b/i, /verse/i],
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function inferColumns(columns, rows) {
  const byHint = Object.fromEntries(
    Object.entries(hints).map(([key, patterns]) => [
      key,
      columns.filter((column) => patterns.some((pattern) => pattern.test(column.name))),
    ]),
  );

  const numericColumns = columns.filter((column) =>
    rows.some((row) => Number.isFinite(Number(row[column.name]))),
  );
  const textColumns = columns.filter((column) =>
    rows.some((row) => typeof row[column.name] === 'string' && row[column.name].trim().length > 0),
  );

  return {
    page: byHint.page[0]?.name ?? numericColumns.find((column) => /int/i.test(column.type))?.name,
    line: byHint.line[0]?.name ?? numericColumns[1]?.name,
    text: byHint.text[0]?.name ?? textColumns[0]?.name,
    surah: byHint.surah[0]?.name ?? numericColumns.find((column) => /sura|chapter/i.test(column.name))?.name,
    ayah: byHint.ayah[0]?.name ?? numericColumns.find((column) => /aya|verse/i.test(column.name))?.name,
  };
}

if (sqliteFiles.length === 0) {
  console.log(`No SQLite files found in ${root}`);
  process.exit(0);
}

for (const file of sqliteFiles) {
  const dbPath = join(root, file);
  console.log(`\n${'='.repeat(80)}\n${file}\n${'='.repeat(80)}`);
  const db = new DatabaseSync(dbPath, { readOnly: true });

  const tables = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();

  console.log('\nTables:');
  for (const table of tables) {
    console.log(`- ${table.name}`);
  }

  for (const table of tables) {
    const tableName = quoteIdentifier(table.name);
    console.log(`\n--- ${table.name} ---`);
    console.log('\nSchema:');
    console.log(table.sql);

    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    console.log('\nColumns:');
    console.table(columns.map(({ cid, name, type, notnull, dflt_value, pk }) => ({ cid, name, type, notnull, dflt_value, pk })));

    const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
    console.log('\nFirst rows:');
    console.dir(rows, { depth: null, colors: false });

    console.log('\nInferred mapping:');
    console.dir(inferColumns(columns, rows), { depth: null, colors: false });
  }

  db.close();
}
