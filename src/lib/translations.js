let urduCache = null;

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
