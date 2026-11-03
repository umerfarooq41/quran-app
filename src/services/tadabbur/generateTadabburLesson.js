export async function generateTadabburLesson(input, options = {}) {
  const response = await fetch('/api/tadabbur/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Unable to generate the Tadabbur lesson.');
    error.status = response.status;
    error.code = payload.code || 'GENERATION_FAILED';
    throw error;
  }

  if (!payload.lesson || typeof payload.lesson !== 'object') {
    throw new Error('The generation service returned an invalid lesson.');
  }

  return payload;
}
