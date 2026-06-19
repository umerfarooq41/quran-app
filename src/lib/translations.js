let urduCache = null;

export const DEFAULT_TRANSLATION_ID = 'ur-maududi';

export const TRANSLATION_OPTIONS = [
  {
    id: DEFAULT_TRANSLATION_ID,
    label: 'Urdu — Maududi',
    language: 'Urdu',
    direction: 'rtl',
  },
];

export async function loadUrduTranslation() {
  if (urduCache) return urduCache;
  const response = await fetch('/data/urMaududi.json');
  if (!response.ok) throw new Error('Urdu translation file was not found.');
  urduCache = await response.json();
  return urduCache;
}

export async function getUrduTranslation(surahNumber, ayahNumber) {
  const data = await loadUrduTranslation();
  return data?.[`${Number(surahNumber)}:${Number(ayahNumber)}`] || '';
}

export async function loadTranslation(translationId = DEFAULT_TRANSLATION_ID) {
  if (translationId === DEFAULT_TRANSLATION_ID) return loadUrduTranslation();
  return {};
}

export async function getTranslation(translationId, surahNumber, ayahNumber) {
  const data = await loadTranslation(translationId);
  return data?.[`${Number(surahNumber)}:${Number(ayahNumber)}`] || '';
}

export function getTranslationOption(translationId = DEFAULT_TRANSLATION_ID) {
  return TRANSLATION_OPTIONS.find((option) => option.id === translationId)
    || TRANSLATION_OPTIONS[0];
}
