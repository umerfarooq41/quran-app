const translationCache = new Map();

export const DEFAULT_TRANSLATION_ID = 'ur-al-maududi';

export const TRANSLATION_OPTIONS = [
  {
    id: 'ur-al-maududi',
    label: 'Ur — Maududi',
    shortName: 'Maududi',
    language: 'Ur',
    direction: 'rtl',
    file: 'ur-al-maududi.json',
  },
  {
    id: 'ur-bayan-ul-quran',
    label: 'Ur — Bayan ul Quran',
    shortName: 'Bayan ul Quran',
    language: 'Ur',
    direction: 'rtl',
    file: 'ur-bayan-ul-quran.json',
  },
  {
    id: 'en-haleem',
    label: 'En — Haleem',
    shortName: 'Haleem',
    language: 'En',
    direction: 'ltr',
    file: 'en-haleem.json',
  },
  {
    id: 'en-al-maududi',
    label: 'En — Maududi',
    shortName: 'Maududi',
    language: 'En',
    direction: 'ltr',
    file: 'en-al-maududi.json',
  },
  {
    id: 'en-maarif-ul-quran',
    label: 'En — Maarif',
    shortName: 'Maarif',
    language: 'En',
    direction: 'ltr',
    file: 'en-maarif-ul-quran.json',
  },
];

export async function loadTranslation(translationId = DEFAULT_TRANSLATION_ID) {
  const normalizedId = getTranslationOption(translationId).id;
  const rawData = await loadRawTranslation(normalizedId);

  return Object.fromEntries(
    Object.entries(rawData).map(([reference, value]) => [
      reference,
      normalizeTranslationEntry(value).plainText,
    ]),
  );
}

export async function loadTranslationEntry(translationId, surahNumber, ayahNumber) {
  const option = getTranslationOption(translationId);
  const data = await loadRawTranslation(option.id);
  const entry = normalizeTranslationEntry(data?.[`${Number(surahNumber)}:${Number(ayahNumber)}`]);

  return {
    ...entry,
    direction: option.direction,
    language: option.language,
  };
}

export async function getTranslation(translationId, surahNumber, ayahNumber) {
  const entry = await loadTranslationEntry(translationId, surahNumber, ayahNumber);
  return entry.plainText || '';
}

export function getTranslationOption(translationId = DEFAULT_TRANSLATION_ID) {
  return TRANSLATION_OPTIONS.find((option) => option.id === translationId)
    || TRANSLATION_OPTIONS[0];
}

async function loadRawTranslation(translationId) {
  const option = getTranslationOption(translationId);

  if (translationCache.has(option.id)) return translationCache.get(option.id);

  const response = await fetch(`/data/translations/${option.file}`);
  if (!response.ok) throw new Error(`${option.label} translation file was not found.`);

  const data = await response.json();
  translationCache.set(option.id, data);
  return data;
}

function normalizeTranslationEntry(value) {
  if (!value) return { text: '', plainText: '', parts: [], footnotes: [] };

  const text = typeof value === 'string' ? value : String(value.t || '');
  const footnoteMap = typeof value === 'object' && value.f && typeof value.f === 'object'
    ? value.f
    : {};
  const footnoteOrder = [];
  const idToNumber = new Map();
  let generatedFootnoteNumber = 0;

  const parts = [];
  let cursor = 0;
  const footnoteRegex = /<sup\s+foot_note="([^"]+)"\s*>\s*([^<]*)\s*<\/sup>/gi;
  let match;

  while ((match = footnoteRegex.exec(text)) !== null) {
    const before = cleanInlineText(text.slice(cursor, match.index));
    if (before) parts.push({ type: 'text', text: before });

    const id = match[1];
    if (!footnoteOrder.includes(id)) footnoteOrder.push(id);

    const visibleNumber = String(match[2] || '').trim();
    const number = idToNumber.get(id)
      || visibleNumber
      || String(++generatedFootnoteNumber);
    idToNumber.set(id, number);

    parts.push({ type: 'footnote', id, number });
    cursor = match.index + match[0].length;
  }

  const after = cleanInlineText(text.slice(cursor));
  if (after) parts.push({ type: 'text', text: after });

  const plainText = partsToPlainText(parts);

  const footnotes = footnoteOrder
    .filter((id) => footnoteMap[id])
    .map((id, index) => ({
      id,
      number: idToNumber.get(id) || String(index + 1),
      text: cleanInlineText(String(footnoteMap[id])),
    }));

  return { text, plainText, parts, footnotes };
}

function cleanInlineText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function partsToPlainText(parts) {
  return parts
    .map((part) => (part.type === 'footnote' ? ` [${part.number}]` : part.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
