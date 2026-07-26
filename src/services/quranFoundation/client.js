const API_ENDPOINT = '/api/qf';

/**
 * Make an authenticated Quran Foundation Content API request through the
 * app's Vercel serverless proxy. Keeping all URL construction here means
 * future Quran Foundation features can reuse the same client.
 */
export async function qfGet(path, params = {}, { signal } = {}) {
  const normalizedPath = String(path || '').replace(/^\/+/, '');

  if (!normalizedPath) {
    throw new Error('Quran API path is required.');
  }

  const query = new URLSearchParams({ path: normalizedPath });

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      return;
    }

    query.set(key, String(value));
  });

  const response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('Quran API returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(
      data?.message
      || data?.error
      || `Quran API request failed (${response.status}).`,
    );
  }

  return data;
}
