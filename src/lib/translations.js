import { qfGet } from '../services/quranFoundation/client';

const translationCache = new Map();
const translationResourceCache = new Map();
const translationCatalogCache = new Map();

export const DEFAULT_TRANSLATION_ID = 'ur-al-maududi';

export const TRANSLATION_OPTIONS = [
  {
    id: 'en-haleem',
    label: "En — The Qur’an (M. A. S. Abdel Haleem)",
    shortName: "The Qur’an (M. A. S. Abdel Haleem)",
    language: 'En',
    direction: 'ltr',
    file: 'en-haleem.json',
  },
  {
    id: 'en-saheeh-international',
    label: "En — The Qur’an: English Meanings (Saheeh International)",
    shortName: "The Qur’an: English Meanings (Saheeh International)",
    language: 'En',
    direction: 'ltr',
    apiLanguage: 'en',
    resourceAliases: ['saheeh international', 'sahih international'],
  },
  {
    id: 'en-pickthall',
    label: "En — The Meaning of the Glorious Qur’an (Marmaduke Pickthall)",
    shortName: "The Meaning of the Glorious Qur’an (Marmaduke Pickthall)",
    language: 'En',
    direction: 'ltr',
    apiLanguage: 'en',
    resourceAliases: ['marmaduke pickthall', 'pickthall'],
  },
  {
    id: 'en-yusuf-ali',
    label: "En — The Holy Qur’an (Abdullah Yusuf Ali)",
    shortName: "The Holy Qur’an (Abdullah Yusuf Ali)",
    language: 'En',
    direction: 'ltr',
    apiLanguage: 'en',
    resourceAliases: ['abdullah yusuf ali', 'yusuf ali'],
  },
  {
    id: 'en-al-maududi',
    label: "En — Tafhim-ul-Quran (Syed Abul A'la Maududi)",
    shortName: "Tafhim-ul-Quran (Syed Abul A'la Maududi)",
    language: 'En',
    direction: 'ltr',
    file: 'en-al-maududi.json',
  },
  {
    id: 'en-maarif-ul-quran',
    label: "En — Maarif-ul-Quran (Mufti Muhammad Shafi)",
    shortName: "Maarif-ul-Quran (Mufti Muhammad Shafi)",
    language: 'En',
    direction: 'ltr',
    file: 'en-maarif-ul-quran.json',
  },
  {
    id: 'ur-al-maududi',
    label: "Ur — Tafhim-ul-Quran (Syed Abul A'la Maududi)",
    shortName: "Tafhim-ul-Quran (Syed Abul A'la Maududi)",
    language: 'Ur',
    direction: 'rtl',
    file: 'ur-al-maududi.json',
  },
  {
    id: 'ur-bayan-ul-quran',
    label: "Ur — Bayan-ul-Quran (Dr. Israr Ahmad)",
    shortName: "Bayan-ul-Quran (Dr. Israr Ahmad)",
    language: 'Ur',
    direction: 'rtl',
    file: 'ur-bayan-ul-quran.json',
  },
  {
    id: 'ur-fateh-jalandhry',
    label: "Ur — The Holy Qur’an Urdu Translation (Fateh Muhammad Jalandhry)",
    shortName: "The Holy Qur’an Urdu Translation (Fateh Muhammad Jalandhry)",
    language: 'Ur',
    direction: 'rtl',
    apiLanguage: 'ur',
    resourceAliases: [
      'fateh muhammad jalandhari',
      'fateh muhammad jalandhry',
      'fateh mohammad jalandhari',
      'jalandhari',
      'jalandhry',
    ],
  },
  {
    id: 'ur-ahmed-ali',
    label: "Ur — The Holy Qur’an Urdu Translation (Ahmed Ali)",
    shortName: "The Holy Qur’an Urdu Translation (Ahmed Ali)",
    language: 'Ur',
    direction: 'rtl',
    apiLanguage: 'ur',
    resourceAliases: ['ahmed ali', 'ahmad ali'],
  },
  {
    id: 'ur-kanzul-iman',
    label: "Ur — Kanz-ul-Iman (Imam Ahmed Raza Khan)",
    shortName: "Kanz-ul-Iman (Imam Ahmed Raza Khan)",
    language: 'Ur',
    direction: 'rtl',
    apiLanguage: 'ur',
    resourceAliases: ['kanzul iman', 'kanz ul iman', 'kanz-ul-iman', 'ahmed raza khan', 'ahmad raza khan'],
  },
  {
    id: 'ur-maarif-ul-quran',
    label: "Ur — Maarif-ul-Quran (Mufti Muhammad Shafi)",
    shortName: "Maarif-ul-Quran (Mufti Muhammad Shafi)",
    language: 'Ur',
    direction: 'rtl',
    apiLanguage: 'ur',
    resourceAliases: ['maarif ul quran', 'maariful quran', "ma'ariful quran"],
  },
];

export const TRANSLATION_LANGUAGES = Object.freeze([
  { id: 'en', label: 'English', direction: 'ltr' },
  { id: 'ur', label: 'Urdu', direction: 'rtl' },
]);

export function getTranslationLanguageId(translationId = DEFAULT_TRANSLATION_ID) {
  return String(getTranslationOption(translationId).language || 'En').toLowerCase();
}

export function getTranslationOptionsForLanguage(languageId) {
  const normalized = String(languageId || '').toLowerCase();
  return TRANSLATION_OPTIONS.filter(
    (option) => String(option.language || '').toLowerCase() === normalized,
  );
}

export function getDefaultTranslationForLanguage(languageId) {
  return getTranslationOptionsForLanguage(languageId)[0] || getTranslationOption(DEFAULT_TRANSLATION_ID);
}

export async function loadTranslation(translationId = DEFAULT_TRANSLATION_ID) {
  const option = getTranslationOption(translationId);

  if (!option.file) {
    // Remote translations are loaded per ayah in the Reader. Returning an empty
    // map keeps Search available for Arabic/reference searches without making
    // 100+ network requests just to build a translation-wide search index.
    return {};
  }

  const rawData = await loadRawTranslation(option);

  return Object.fromEntries(
    Object.entries(rawData).map(([reference, value]) => [
      reference,
      normalizeTranslationEntry(value).plainText,
    ]),
  );
}

export async function loadTranslationEntry(translationId, surahNumber, ayahNumber, options = {}) {
  const option = getTranslationOption(translationId);
  let rawEntry;

  if (option.file) {
    const data = await loadRawTranslation(option);
    rawEntry = data?.[`${Number(surahNumber)}:${Number(ayahNumber)}`];
  } else {
    rawEntry = await loadRemoteTranslationEntry(option, surahNumber, ayahNumber, options);
  }

  const entry = normalizeTranslationEntry(rawEntry);

  return {
    ...entry,
    direction: option.direction,
    language: option.language,
    source: option,
  };
}

export async function getTranslation(translationId, surahNumber, ayahNumber) {
  const entry = await loadTranslationEntry(translationId, surahNumber, ayahNumber);
  return entry.plainText || '';
}

export function getTranslationOption(translationId = DEFAULT_TRANSLATION_ID) {
  return TRANSLATION_OPTIONS.find((option) => option.id === translationId)
    || TRANSLATION_OPTIONS.find((option) => option.id === DEFAULT_TRANSLATION_ID)
    || TRANSLATION_OPTIONS[0];
}

async function loadRawTranslation(option) {
  if (translationCache.has(option.id)) return translationCache.get(option.id);

  const response = await fetch(`/data/translations/${option.file}`);
  if (!response.ok) throw new Error(`${option.label} translation file was not found.`);

  const data = await response.json();
  translationCache.set(option.id, data);
  return data;
}

async function loadRemoteTranslationEntry(option, surahNumber, ayahNumber, { signal } = {}) {
  const verseKey = `${Number(surahNumber)}:${Number(ayahNumber)}`;
  const cacheKey = `${option.id}:${verseKey}`;

  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const resourceId = await resolveTranslationResourceId(option, signal);
  const payload = await qfGet(
    `translations/${resourceId}`,
    {
      verse_key: verseKey,
      foot_notes: true,
      fields: 'resource_name,language_name,verse_key',
    },
    { signal },
  );
  const row = Array.isArray(payload?.translations)
    ? payload.translations.find((item) => item?.verse_key === verseKey) || payload.translations[0]
    : payload?.translation || payload;

  const entry = {
    t: String(row?.text || ''),
    f: normalizeRemoteFootnotes(row),
  };

  translationCache.set(cacheKey, entry);
  return entry;
}

async function resolveTranslationResourceId(option, signal) {
  if (Number.isFinite(Number(option.resourceId))) return Number(option.resourceId);
  if (translationResourceCache.has(option.id)) return translationResourceCache.get(option.id);

  const language = option.apiLanguage || getTranslationLanguageId(option.id);
  const resources = await loadTranslationCatalog(language, signal);
  const aliases = (option.resourceAliases || []).map(normalizeResourceName).filter(Boolean);

  const match = resources.find((resource) => {
    const searchable = normalizeResourceName([
      resource?.name,
      resource?.translated_name?.name,
      resource?.author_name,
      resource?.slug,
      resource?.language_name,
    ].filter(Boolean).join(' '));

    return aliases.some((alias) => searchable.includes(alias));
  });

  const resourceId = Number(match?.id);
  if (!resourceId) {
    throw new Error(`${option.shortName || option.label} is not available from Quran Foundation right now.`);
  }

  translationResourceCache.set(option.id, resourceId);
  return resourceId;
}

async function loadTranslationCatalog(language, signal) {
  if (translationCatalogCache.has(language)) return translationCatalogCache.get(language);

  const request = qfGet('resources/translations', { language }, { signal })
    .then((payload) => Array.isArray(payload?.translations) ? payload.translations : [])
    .catch((error) => {
      translationCatalogCache.delete(language);
      throw error;
    });

  translationCatalogCache.set(language, request);
  return request;
}

function normalizeRemoteFootnotes(row) {
  const candidate = row?.foot_notes || row?.footnotes || row?.notes || {};
  if (Array.isArray(candidate)) {
    return Object.fromEntries(candidate.map((note, index) => [
      String(note?.id || note?.number || index + 1),
      String(note?.text || note?.body || note || ''),
    ]));
  }
  return candidate && typeof candidate === 'object' ? candidate : {};
}

function normalizeTranslationEntry(value) {
  if (!value) return { text: '', plainText: '', parts: [], footnotes: [] };

  const text = typeof value === 'string' ? value : String(value.t || value.text || '');
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

function normalizeResourceName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
