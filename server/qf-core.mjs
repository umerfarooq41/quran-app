const AUTH_URL = 'https://oauth2.quran.foundation/oauth2/token';
const API_BASE = 'https://apis.quran.foundation/content/api/v4';
const SKEW_MS = 60_000;

let tokenCache = null;

export function hasQfConfig(env = process.env) {
  return Boolean(env.QF_CLIENT_ID && env.QF_CLIENT_SECRET);
}

async function getAccessToken(env = process.env) {
  if (!hasQfConfig(env)) {
    throw new Error('QF_CLIENT_ID and QF_CLIENT_SECRET must be configured in Vercel environment variables.');
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt - SKEW_MS) {
    return tokenCache.accessToken;
  }

  const credentials = Buffer.from(
    `${env.QF_CLIENT_ID}:${env.QF_CLIENT_SECRET}`,
    'utf8',
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'content',
  });

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Quran Foundation authentication failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const token = await response.json();
  if (!token.access_token) {
    throw new Error('Quran Foundation did not return an access token.');
  }

  tokenCache = {
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
  };

  return tokenCache.accessToken;
}

export async function qfRequest(pathWithQuery, env = process.env) {
  const accessToken = await getAccessToken(env);
  const safePath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;

  const response = await fetch(`${API_BASE}${safePath}`, {
    method: 'GET',
    headers: {
      'x-auth-token': accessToken,
      'x-client-id': env.QF_CLIENT_ID,
      accept: 'application/json',
    },
  });

  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    body,
  };
}
