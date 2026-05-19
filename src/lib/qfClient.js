async function qfFetch(path) {
  let response;
  try {
    response = await fetch(`/api/qf${path}`);
  } catch {
    throw new Error('Audio API route is not reachable. Deploy the /api/qf route or run the Vite dev proxy.');
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.error || payload?.message || text || `Quran Foundation request failed (${response.status})`;
    throw new Error(detail);
  }

  return payload ?? {};
}

export const qfClient = {
  reciters: () => qfFetch('/resources/recitations'),
  audioForAyah: (recitationId, surahNumber, ayahNumber) => {
    if (!recitationId) throw new Error('Select a reciter before playing audio.');
    return qfFetch(`/quran/recitations/${recitationId}/by_ayah/${surahNumber}:${ayahNumber}`);
  },
};
