const API_PREFIX = '/api/qf';

export async function qfGet(path, params = {}, { signal } = {}) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
    else query.set(key, String(value));
  });

  const response = await fetch(`${API_PREFIX}${safePath}${query.size ? `?${query}` : ''}`, {
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
    throw new Error(data?.error || data?.message || `Quran API request failed (${response.status}).`);
  }

  return data;
}
