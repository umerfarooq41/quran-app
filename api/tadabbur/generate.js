const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_BODY_BYTES = 100 * 1024;
const MIN_RANGE_LENGTH = 3;
const MAX_RANGE_LENGTH = 15;
const MAX_SOURCE_CHARS = 18000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 5;
const requestsByIp = new Map();

const responseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    prepare: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        questions: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
          },
        },
      },
      required: ['description', 'questions'],
    },
    understand: {
      type: 'object',
      properties: {
        keyPoints: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              ayahReferences: { type: 'array', items: { type: 'string' } },
            },
            required: ['text', 'ayahReferences'],
          },
        },
      },
      required: ['keyPoints'],
    },
    themes: {
      type: 'object',
      properties: {
        main: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'string' } },
        secondary: { type: 'array', maxItems: 4, items: { type: 'string' } },
      },
      required: ['main', 'secondary'],
    },
    apply: {
      type: 'object',
      properties: {
        suggestion: { type: 'string' },
        ayahReferences: { type: 'array', items: { type: 'string' } },
      },
      required: ['suggestion', 'ayahReferences'],
    },
  },
  required: ['title', 'prepare', 'understand', 'themes', 'apply'],
};

const SYSTEM_PROMPT = `
You create concise, careful content for a Qur'an reflection journal. You are not writing a sermon, article, fatwa, or authoritative Tafsir.

Return content matching the supplied JSON schema. Do not add sections.

SOURCE RULES:
- The Arabic Qur'an text is the primary source. Use the supplied translation to convey its meaning.
- If a trusted Tafsir passage is supplied, use it only to clarify and ground the Understand key points. Do not add explanations that are not supported by the supplied Tafsir.
- If Tafsir is absent, create direct textual observations from the Arabic and supplied translation only. Do not invent historical context, causes of revelation, scholarly opinions, or theological explanations.
- Word-by-word glosses, if supplied, are lexical aids only; do not treat them as Tafsir.
- Never imply that your own reflective wording is an established scholarly interpretation.
- Every Ayah reference must fall within the supplied passage.

PREPARE:
- Exactly three questions.
- These are PRE-READING questions. The reader answers them BEFORE reading or studying the selected Ayahs.
- Ask what the reader already knows, thinks, believes, or has experienced about the broad subject of the passage.
- Do not explain, paraphrase, quote, reveal, or give away the selected Ayahs' message.
- Do not ask what phrase/word stands out, what the verse says, or what the reader learned from the passage.
- Make each question answerable from prior knowledge or personal experience.
- Questions must be distinct, clear, open-ended, and non-leading.

UNDERSTAND:
- Generate 1–4 concise points, only as many as the sources support.
- With Tafsir: faithfully summarize the supplied Tafsir alongside the translation.
- Without Tafsir: use only direct observations from the text and translation.
- Do not merely repeat the same point in different words.

THEMES:
- One main theme and up to four concise secondary themes.
- Themes must be specific to this passage, not generic labels that could fit almost any passage.

APPLY:
- Give one gentle, optional, practical suggestion directly connected to the passage.
- Do not impose a routine, assume the reader has a particular problem, or turn the passage into generic productivity advice.
- If a meaningful application is not supported, return an empty suggestion and empty references.

STYLE:
- Natural, accessible language.
- No sermon-like, academic, poetic, guilt-inducing, or inflated wording.
- No generated dua.
- No reflect/connect/review questions. The app supplies the same three final reflection questions for every lesson.
- Never answer questions on behalf of the reader.
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Reflect generation is not configured yet.' });
  }

  const rateResult = checkRateLimit(getClientIp(req));
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', String(rateResult.retryAfter));
    return res.status(429).json({ error: 'Too many generation requests. Please try again shortly.' });
  }

  try {
    const body = await readJsonBody(req);
    const input = validateInput(body);
    const prompt = buildPrompt(input);

    const generation = await generateWithFallback({ apiKey, prompt });
    const { payload, model } = generation;

    if (!generation.ok) {
      const upstreamStatus = generation.status;
      const status = upstreamStatus === 429 ? 429 : upstreamStatus >= 500 ? 503 : 400;
      return res.status(status).json({
        error: upstreamStatus === 503
          ? 'Gemini is temporarily overloaded. Please try again in a minute.'
          : upstreamStatus === 429
            ? 'Gemini request limit reached. Please wait for the quota window to reset, or check your Google AI Studio billing tier.'
            : 'Gemini could not generate this lesson. Please try again.',
        code: upstreamStatus === 503 ? 'SERVICE_UNAVAILABLE' : upstreamStatus === 429 ? 'QUOTA_EXCEEDED' : 'GEMINI_ERROR',
        providerMessage: String(payload?.error?.message || payload?.error?.status || '').slice(0, 500),
        providerStatus: payload?.error?.status || null,
        model,
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Gemini returned an empty response.', code: 'EMPTY_RESPONSE' });
    }

    let lesson;
    try {
      lesson = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Gemini returned invalid lesson data.', code: 'INVALID_JSON' });
    }

    const validation = validateLesson(lesson, input);
    if (!validation.valid) {
      return res.status(502).json({
        error: 'Gemini returned lesson content that did not pass validation.',
        code: 'INVALID_LESSON',
      });
    }

    return res.status(200).json({
      lesson,
      model,
      generatedAt: new Date().toISOString(),
      sources: {
        translationName: input.translationName,
        tafsirName: input.tafsirText ? input.tafsirName : null,
        tafsirIncluded: Boolean(input.tafsirText),
        outputLanguage: input.outputLanguage,
        wordByWordLanguage: input.wordByWordLanguage || null,
      },
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Invalid generation request.' });
  }
}

async function generateWithFallback({ apiKey, prompt }) {
  const models = [MODEL, 'gemini-3.7-flash'];
  let lastResult = null;

  for (const model of [...new Set(models)]) {
    const attempts = model === MODEL ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseJsonSchema: responseSchema,
                temperature: 0.45,
                maxOutputTokens: 3500,
              },
            }),
          },
        );
      } catch (error) {
        lastResult = { ok: false, status: 503, payload: { error: { message: error.message || 'Network request failed.' } }, model };
        if (attempt < attempts - 1) await delay(1500 * (2 ** attempt));
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true, status: response.status, payload, model };

      lastResult = { ok: false, status: response.status, payload, model };
      // A model-specific free-tier RPM limit can be worked around by trying
      // the fallback model, which has its own per-model quota bucket.
      if (response.status === 429 && isPerMinuteRateLimit(payload)) {
        if (model === MODEL) break;
        return lastResult;
      }

      // Retry transient overload/server failures; don't hide billing/day quota errors.
      if (response.status !== 503 && response.status < 500) return lastResult;
      if (attempt < attempts - 1) await delay(1500 * (2 ** attempt));
    }

    // Try the fallback model only when the primary model is unavailable.
    if (lastResult && lastResult.status !== 503 && lastResult.status < 500) break;
  }

  return lastResult || { ok: false, status: 503, payload: { error: { message: 'No Gemini model was available.' } }, model: MODEL };
}

function isPerMinuteRateLimit(payload) {
  const message = String(payload?.error?.message || '').toLowerCase();
  const violations = payload?.error?.details
    ?.flatMap((detail) => detail?.violations || []) || [];
  const quotaIds = violations.map((item) => String(item?.quotaId || '').toLowerCase());
  return quotaIds.some((id) => id.includes('perminute'))
    || (message.includes('per minute') && message.includes('free tier'));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === String(host).split(',')[0].trim();
  } catch {
    return false;
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const current = requestsByIp.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now >= current.resetAt) {
    current.count = 0;
    current.resetAt = now + RATE_WINDOW_MS;
  }
  current.count += 1;
  requestsByIp.set(ip, current);

  if (requestsByIp.size > 2000) {
    for (const [key, value] of requestsByIp) {
      if (now >= value.resetAt) requestsByIp.delete(key);
    }
  }

  return {
    allowed: current.count <= RATE_LIMIT,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function validateInput(body) {
  const surahNumber = Number(body?.surahNumber);
  const startAyah = Number(body?.startAyah);
  const endAyah = Number(body?.endAyah);
  const verses = Array.isArray(body?.verses) ? body.verses : [];

  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new Error('Invalid Surah number.');
  }
  if (!Number.isInteger(startAyah) || !Number.isInteger(endAyah) || startAyah < 1 || endAyah < startAyah) {
    throw new Error('Invalid Ayah range.');
  }
  if (endAyah - startAyah + 1 < MIN_RANGE_LENGTH || endAyah - startAyah + 1 > MAX_RANGE_LENGTH) {
    throw new Error(`A Reflect passage must contain between ${MIN_RANGE_LENGTH} and ${MAX_RANGE_LENGTH} Ayahs.`);
  }
  if (verses.length !== endAyah - startAyah + 1) {
    throw new Error('The supplied Ayahs do not match the selected range.');
  }

  const normalizedVerses = verses.map((verse, index) => {
    const ayahNumber = startAyah + index;
    if (Number(verse?.ayahNumber) !== ayahNumber) {
      throw new Error('Ayah references must be consecutive and match the selected range.');
    }
    const arabic = cleanSource(verse?.arabic, 3000, 'Arabic text');
    const translation = cleanSource(verse?.translation, 5000, 'Translation');
    if (!arabic || !translation) throw new Error('Arabic text and translation are required for every Ayah.');
    return { ayahNumber, arabic, translation };
  });

  const tafsirText = cleanSource(body?.tafsirText, MAX_SOURCE_CHARS, 'Tafsir', true);
  const wordByWordText = cleanSource(body?.wordByWordText, 8000, 'Word-by-word text', true);

  return {
    surahNumber,
    startAyah,
    endAyah,
    verses: normalizedVerses,
    tafsirText,
    wordByWordText,
    translationName: cleanLabel(body?.translationName, 120) || 'Selected translation',
    tafsirName: cleanLabel(body?.tafsirName, 120),
    outputLanguage: body?.outputLanguage === 'ur' ? 'ur' : 'en',
    wordByWordLanguage: body?.wordByWordLanguage === 'ur' ? 'ur' : body?.wordByWordLanguage === 'en' ? 'en' : null,
  };
}

function cleanSource(value, maxLength, label, optional = false) {
  if (value == null && optional) return '';
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

function cleanLabel(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function buildPrompt(input) {
  const verses = input.verses.map((verse) => (
    `Ayah ${input.surahNumber}:${verse.ayahNumber}\nArabic: ${verse.arabic}\nTranslation: ${verse.translation}`
  )).join('\n\n');

  return [
    `Create a Reflect lesson for Surah ${input.surahNumber}, Ayahs ${input.startAyah}–${input.endAyah}.`,
    `Write all generated content in ${input.outputLanguage === 'ur' ? 'Urdu' : 'English'}.`,
    `Selected translation: ${input.translationName}.`,
    `TAFSIR STATUS: ${input.tafsirText ? `Available. Selected source: ${input.tafsirName || 'User-selected Tafsir'}.` : 'No Tafsir was supplied. Use only the Arabic text and translation.'}`,
    'QURAN PASSAGE:',
    verses,
    input.tafsirText ? `SELECTED TAFSIR (trusted source supplied by the app; summarize faithfully):\n${input.tafsirText}` : '',
    input.wordByWordText ? `WORD-BY-WORD GLOSSES (lexical aid only; not Tafsir):\n${input.wordByWordText}` : '',
    'Remember: Prepare questions must be answered BEFORE the reader studies this passage. Do not reveal the passage meaning in those questions.',
  ].filter(Boolean).join('\n\n');
}

function validateLesson(lesson, input) {
  if (!lesson || typeof lesson !== 'object') return { valid: false };
  if (!isShortText(lesson.title, 100)) return { valid: false };
  if (!lesson.prepare || !Array.isArray(lesson.prepare.questions) || lesson.prepare.questions.length !== 3) return { valid: false };
  if (!Array.isArray(lesson.understand?.keyPoints) || lesson.understand.keyPoints.length < 1 || lesson.understand.keyPoints.length > 4) return { valid: false };
  if (!Array.isArray(lesson.themes?.main) || lesson.themes.main.length !== 1) return { valid: false };
  if (!Array.isArray(lesson.themes?.secondary) || lesson.themes.secondary.length > 4) return { valid: false };
  if (typeof lesson.apply?.suggestion !== 'string' || !Array.isArray(lesson.apply.ayahReferences)) return { valid: false };

  const allowedRefs = new Set(input.verses.map((verse) => `${input.surahNumber}:${verse.ayahNumber}`));
  const allQuestions = lesson.prepare.questions;
  const allPoints = lesson.understand.keyPoints;
  if (allQuestions.some((item) => !isShortText(item?.text, 360))) return { valid: false };
  for (const item of allPoints) {
    if (!isShortText(item?.text, 360) || !Array.isArray(item.ayahReferences) || item.ayahReferences.length < 1) return { valid: false };
    if (item.ayahReferences.some((ref) => !allowedRefs.has(String(ref)))) return { valid: false };
  }
  const normalizedQuestions = allQuestions.map((item) => item.text.trim().toLocaleLowerCase().replace(/\s+/g, ' '));
  if (new Set(normalizedQuestions).size !== normalizedQuestions.length) return { valid: false };
  if (lesson.apply.ayahReferences.some((ref) => !allowedRefs.has(String(ref)))) return { valid: false };
  return { valid: true };
}

function isShortText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}
