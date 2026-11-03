export async function generateTadabburLesson(input, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  let response;
  try {
    response = await fetch('/api/tadabbur/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError' && !options.signal?.aborted) {
      throw new Error('Gemini took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Unable to generate the Tadabbur lesson.');
    error.status = response.status;
    error.code = payload.code || 'GENERATION_FAILED';
    error.providerMessage = payload.providerMessage || '';
    throw error;
  }

  if (!payload.lesson || typeof payload.lesson !== 'object') {
    throw new Error('The generation service returned an invalid lesson.');
  }

  return payload;
}
