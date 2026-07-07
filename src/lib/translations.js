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
  if (!value) return { text: '', plainText: '', footnotes: [] };

  const text = typeof value === 'string' ? value : String(value.t || '');
  const footnoteMap = typeof value === 'object' && value.f && typeof value.f === 'object'
    ? value.f
    : {};
  const footnoteOrder = [];
  let footnoteNumber = 0;

  const plainText = text
    .replace(/<sup\s+foot_note="([^"]+)"\s*>\s*([^<]*)\s*<\/sup>/gi, (_, id, visibleNumber) => {
      if (!footnoteOrder.includes(id)) footnoteOrder.push(id);
      const number = String(visibleNumber || '').trim() || String(++footnoteNumber);
      return ` [${number}]`;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const footnotes = footnoteOrder
    .filter((id) => footnoteMap[id])
    .map((id, index) => ({
      id,
      number: index + 1,
      text: String(footnoteMap[id]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    }));

  return { text, plainText, footnotes };
}
