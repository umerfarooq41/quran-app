import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const pageDbPath = join(root, 'taj-indopak-16-lines.db');
const wordDbPath = join(root, 'indopak-nastaleeq word by word.db');
const surahInfoPath = join(root, 'src/data/surahInfoEn.json');
const pagesOutPath = join(root, 'src/data/quranPages16.json');
const wordsOutPath = join(root, 'src/data/quranWords.json');
const ayahsOutPath = join(root, 'src/data/quranAyahs.json');

for (const requiredPath of [pageDbPath, wordDbPath, surahInfoPath]) {
  if (!existsSync(requiredPath)) {
    console.error(`Missing required source file: ${requiredPath}`);
    process.exit(1);
  }
}

mkdirSync(dirname(pagesOutPath), { recursive: true });

const pageDb = new DatabaseSync(pageDbPath, { readOnly: true });
const wordDb = new DatabaseSync(wordDbPath, { readOnly: true });
const surahInfo = JSON.parse(readFileSync(surahInfoPath, 'utf8'));

const info = pageDb.prepare('SELECT * FROM info LIMIT 1').get();
const layoutRows = pageDb
  .prepare('SELECT * FROM pages ORDER BY page_number, line_number')
  .all();
const allWords = wordDb
  .prepare('SELECT id, location, surah, ayah, word, text FROM words ORDER BY id')
  .all();

const wordsById = new Map(allWords.map((word) => [Number(word.id), word]));
const wordsByAyah = new Map();
for (const word of allWords) {
  const key = `${word.surah}:${word.ayah}`;
  const list = wordsByAyah.get(key) ?? [];
  list.push({
    id: Number(word.id),
    location: word.location,
    word: Number(word.word),
    text: word.text,
  });
  wordsByAyah.set(key, list);
}

const pages = new Map();
const errors = [];

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && value !== '' && value !== null ? number : null;
}

function wordsInRange(firstWordId, lastWordId) {
  const first = numberOrNull(firstWordId);
  const last = numberOrNull(lastWordId);
  if (first === null || last === null) return [];
  const words = [];
  for (let id = first; id <= last; id += 1) {
    const word = wordsById.get(id);
    if (!word) {
      errors.push(`Missing word id ${id} in range ${first}-${last}`);
      continue;
    }
    words.push(word);
  }
  return words;
}

function ayahBounds(words) {
  if (words.length === 0) {
    return { surahNumber: null, ayahStart: null, ayahEnd: null, firstWordId: null, lastWordId: null };
  }
  const first = words[0];
  const last = words[words.length - 1];
  return {
    surahNumber: Number(first.surah),
    ayahStart: Number(first.ayah),
    ayahEnd: Number(last.ayah),
    firstWordId: Number(first.id),
    lastWordId: Number(last.id),
  };
}

function surahTitle(number) {
  const infoRow = surahInfo[String(number)];
  return infoRow?.surah_name ? `سورة ${infoRow.surah_name}` : `سورة ${number}`;
}

for (const row of layoutRows) {
  const pageNumber = Number(row.page_number);
  const lineNumber = Number(row.line_number);
  if (!pages.has(pageNumber)) pages.set(pageNumber, { page: pageNumber, lines: [] });

  const lineWords = wordsInRange(row.first_word_id, row.last_word_id);
  const bounds = ayahBounds(lineWords);
  const surahNumber = numberOrNull(row.surah_number) ?? bounds.surahNumber;
  const text = row.line_type === 'surah_name' ? surahTitle(surahNumber) : lineWords.map((word) => word.text).join(' ');

  pages.get(pageNumber).lines.push({
    line: lineNumber,
    text,
    surahNumber,
    ayahStart: bounds.ayahStart,
    ayahEnd: bounds.ayahEnd,
    type: row.line_type,
    isCentered: Boolean(Number(row.is_centered)),
    firstWordId: bounds.firstWordId,
    lastWordId: bounds.lastWordId,
  });
}

const pageCount = Number(info?.number_of_pages ?? Math.max(...pages.keys()));
const linesPerPage = Number(info?.lines_per_page ?? 16);
const pageList = [];
for (let page = 1; page <= pageCount; page += 1) {
  const entry = pages.get(page) ?? { page, lines: [] };
  const existingLines = new Set(entry.lines.map((line) => line.line));
  if (entry.lines.length !== linesPerPage) {
    errors.push(`Page ${page} has ${entry.lines.length} recorded lines; expected ${linesPerPage}. Spacer lines will be inserted.`);
  }
  for (let line = 1; line <= linesPerPage; line += 1) {
    if (!existingLines.has(line)) {
      entry.lines.push({
        line,
        text: '',
        surahNumber: null,
        ayahStart: null,
        ayahEnd: null,
        type: 'spacer',
        isCentered: false,
        firstWordId: null,
        lastWordId: null,
      });
    }
  }
  entry.lines.sort((a, b) => a.line - b.line);
  pageList.push(entry);
}

const ayahs = [...wordsByAyah.entries()].map(([key, words]) => {
  const [surahNumber, ayahNumber] = key.split(':').map(Number);
  return {
    key,
    surahNumber,
    ayahNumber,
    text: words.map((word) => word.text).join(' '),
    words,
  };
});

writeFileSync(pagesOutPath, `${JSON.stringify(pageList, null, 2)}\n`, 'utf8');
writeFileSync(wordsOutPath, `${JSON.stringify(ayahs, null, 2)}\n`, 'utf8');
writeFileSync(ayahsOutPath, `${JSON.stringify(ayahs.map(({ words, ...ayah }) => ayah), null, 2)}\n`, 'utf8');

if (errors.length > 0) {
  console.error('\nValidation notes:');
  for (const error of errors) console.error(`- ${error}`);
} else {
  console.log('Validation passed with no errors.');
}

console.log(`Wrote ${pageList.length} pages to ${pagesOutPath}`);
console.log(`Wrote ${ayahs.length} ayah records to ${wordsOutPath}`);

pageDb.close();
wordDb.close();
