export const RECITERS = [
  { id: 'mishari-rashid-al-afasy', displayName: 'Mishari Rashid Al Afasy', imageFile: 'Mishari Rashid Al Afasy.jpeg', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abdur-rahman-as-sudais', displayName: 'Abdur Rahman As Sudais', imageFile: 'Abdur Rahman As Sudais.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abdul-basit-abdul-samad', displayName: 'Abdul Basit Abdul Samad', imageFile: 'Abdul Basit Abdul Samad.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'abdullah-awad-al-juhani', displayName: 'Abdullah Awad Al Juhani', imageFile: 'Abdullah Awad Al Juhani.png', ayahCount: 6236, hasAyahAudioUrls: false },
  { id: 'abu-bakr-al-shatri', displayName: 'Abu Bakr Al Shatri', imageFile: 'Abu Bakr Al Shatri.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'maher-al-mu-aiqly', displayName: 'Maher Al Muaiqly', imageFile: 'Maher Al Muaiqly.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'mahmoud-khalil-al-husary', displayName: 'Mahmoud Khalil Al Husary', imageFile: 'Mahmoud Khalil Al Husary.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'saad-al-ghamdi', displayName: 'Saad Al Ghamdi', imageFile: 'Saad Al Ghamdi.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'saud-al-shuraim', displayName: 'Saud Al Shuraim', imageFile: 'Saud Al Shuraim.png', ayahCount: 6236, hasAyahAudioUrls: true },
  { id: 'yasser-al-dosari', displayName: 'Yasser Al Dosari', imageFile: 'Yasser Al Dosari.png', ayahCount: 6236, hasAyahAudioUrls: true },
];

const audioCache = new Map();
const DIRECT_AUDIO_BASE_BY_RECITER = Object.freeze({
  'mishari-rashid-al-afasy': 'https://audio-cdn.tarteel.ai/quran/alafasy',
  'abdur-rahman-as-sudais': 'https://audio.qurancdn.com/Sudais/mp3',
  'abdul-basit-abdul-samad': 'https://audio-cdn.tarteel.ai/quran/abdulBasitMurattal',
  'abu-bakr-al-shatri': 'https://audio-cdn.tarteel.ai/quran/abuBakrAlShatri',
  'maher-al-mu-aiqly': 'https://audio-cdn.tarteel.ai/quran/maherAlMuaiqly',
  'mahmoud-khalil-al-husary': 'https://audio-cdn.tarteel.ai/quran/husary',
  'saad-al-ghamdi': 'https://audio-cdn.tarteel.ai/quran/ghamadi',
  'saud-al-shuraim': 'https://audio-cdn.tarteel.ai/quran/saudAlShuraim',
  'yasser-al-dosari': 'https://audio-cdn.tarteel.ai/quran/yasserAlDosari',
});

export function getDefaultReciterId() {
  return RECITERS[0]?.id || '';
}

export function normalizeLocalReciters() {
  return RECITERS.map((reciter) => ({
    id: reciter.id,
    name: reciter.displayName,
    reciter_name: reciter.displayName,
    imageFile: reciter.imageFile,
    ayahCount: reciter.ayahCount,
    hasAyahAudioUrls: reciter.hasAyahAudioUrls,
    source: 'bundled-json',
  }));
}

export function getReciterImageUrl(reciter) {
  const imageFile = reciter?.imageFile;
  return imageFile ? `/reciters/${encodeURIComponent(imageFile)}` : '';
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
  const reciter = RECITERS.find((item) => item.id === (reciterId || getDefaultReciterId()));
  if (reciter && !reciter.hasAyahAudioUrls) return '';

  const directUrl = getBundledAudioUrl(reciterId, surahNumber, ayahNumber);
  if (directUrl) return directUrl;

  const data = await loadReciterAudio(reciterId);
  const key = `${Number(surahNumber)}:${Number(ayahNumber)}`;
  return data?.[key]?.audio_url || '';
}

export function getBundledAudioUrl(reciterId, surahNumber, ayahNumber) {
  const baseUrl = DIRECT_AUDIO_BASE_BY_RECITER[reciterId || getDefaultReciterId()];
  const surah = Number(surahNumber);
  const ayah = Number(ayahNumber);

  if (!baseUrl || !Number.isInteger(surah) || !Number.isInteger(ayah)) return '';

  return `${baseUrl}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

export function getNextAyahRef(surahNumber, ayahNumber, ayahs) {
  const currentIndex = ayahs.findIndex(
    (ayah) => ayah.surahNumber === Number(surahNumber) && ayah.ayahNumber === Number(ayahNumber),
  );
  if (currentIndex < 0 || currentIndex >= ayahs.length - 1) return null;
  const next = ayahs[currentIndex + 1];
  return { surahNumber: next.surahNumber, ayahNumber: next.ayahNumber };
}
