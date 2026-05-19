export const RECITERS = [
  { id: 'mishari-rashid-al-afasy', displayName: 'Mishari Rashid Al Afasy', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abdur-rahman-as-sudais', displayName: 'Abdur Rahman As Sudais', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abdul-basit-abdul-samad', displayName: 'Abdul Basit Abdul Samad', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abu-bakr-al-shatri', displayName: 'Abu Bakr Al Shatri', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'maher-al-mu-aiqly', displayName: 'Maher Al Muaiqly', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'mahmoud-khalil-al-husary', displayName: 'Mahmoud Khalil Al Husary', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'saad-al-ghamdi', displayName: 'Saad Al Ghamdi', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'saud-al-shuraim', displayName: 'Saud Al Shuraim', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'yasser-al-dosari', displayName: 'Yasser Al Dosari', ayahCount: 6236, hasAyahAudioUrls: true },
];

const audioCache = new Map();

export function getDefaultReciterId() {
  return RECITERS[0]?.id || '';
}

export function normalizeLocalReciters() {
  return RECITERS.map((reciter) => ({
    id: reciter.id,
    name: reciter.displayName,
    reciter_name: reciter.displayName,
    ayahCount: reciter.ayahCount,
    source: 'bundled-json',
  }));
}

export async function loadReciterAudio(reciterId) {
  const id = reciterId || getDefaultReciterId();
  if (audioCache.has(id)) return audioCache.get(id);
  const response = await fetch(`/data/audio/${id}.json`);
  if (!response.ok) throw new Error(`Bundled audio file not found for ${id}.`);
  const data = await response.json();
  audioCache.set(id, data);
  return data;
}

export async function getAudioUrl(reciterId, surahNumber, ayahNumber) {
  const data = await loadReciterAudio(reciterId);
  const key = `${Number(surahNumber)}:${Number(ayahNumber)}`;
  return data?.[key]?.audio_url || '';
}

export function getNextAyahRef(surahNumber, ayahNumber, ayahs) {
  const currentIndex = ayahs.findIndex(
    (ayah) => ayah.surahNumber === Number(surahNumber) && ayah.ayahNumber === Number(ayahNumber),
  );
  if (currentIndex < 0 || currentIndex >= ayahs.length - 1) return null;
  const next = ayahs[currentIndex + 1];
  return { surahNumber: next.surahNumber, ayahNumber: next.ayahNumber };
}
