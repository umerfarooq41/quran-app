import { getSurahAyahs, getSurah } from '../../lib/quran';
import { getTranslationOption, loadTranslationEntry } from '../../lib/translations';
import { getWordByWordTranslation } from '../quranFoundation/words';
import { saveTadabburLesson } from '../../lib/db';

export const REFLECT_FINAL_QUESTIONS = Object.freeze([
  'What is the most important thing you learned from these Ayahs?',
  'What did these Ayahs make you reflect on about yourself?',
  'What is one thing you want to remember or apply from this lesson?',
]);

export const REFLECT_PREPARATION_QUESTIONS = Object.freeze([
  'What do you already know or understand about the subject of this passage?',
  'What experiences or questions have shaped the way you think about this subject?',
  'What would you like to pay attention to as you study this passage?',
]);

/**
 * Create a source-led Reflect study without AI. The app stores the selected
 * Quran text and source material as a local snapshot; it does not generate
 * interpretations, themes, or applications.
 */
export async function createTadabburLesson({
  surahNumber,
  startAyah,
  endAyah,
  settings,
  signal,
}) {
  const surah = Number(surahNumber);
  const start = Number(startAyah);
  const end = Number(endAyah);
  const appSettings = settings || {};

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Select a valid Surah.');
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new Error('Select a valid Ayah range.');
  }
  if (end - start + 1 < 3 || end - start + 1 > 15) {
    throw new Error('A Reflect passage must contain between 3 and 15 Ayahs.');
  }

  const surahAyahs = getSurahAyahs(surah);
  const selectedAyahs = surahAyahs.filter((ayah) => (
    Number(ayah.ayahNumber) >= start && Number(ayah.ayahNumber) <= end
  ));
  if (selectedAyahs.length !== end - start + 1) {
    throw new Error('The selected Ayah range is not available in the Quran data.');
  }

  const translationId = appSettings.translation;
  const translationOption = getTranslationOption(translationId);
  const outputLanguage = String(translationOption.language || 'En').toLowerCase() === 'ur'
    ? 'ur'
    : 'en';
  const includeWordByWord = true;
  const wordByWordLanguage = appSettings.wordByWordLanguage === 'ur' ? 'ur' : 'en';

  const sourceRows = await Promise.all(selectedAyahs.map(async (ayah) => {
    if (signal?.aborted) throw new DOMException('Study creation was cancelled.', 'AbortError');

    const ayahNumber = Number(ayah.ayahNumber);
    const translationEntry = await waitForSignal(loadTranslationEntry(
      translationId,
      surah,
      ayahNumber,
      { includeTafsir: true, signal },
    ), signal);
    const translation = String(translationEntry?.plainText || '').trim();
    if (!translation) {
      throw new Error(`Translation is unavailable for ${surah}:${ayahNumber}. Connect to the internet and try again.`);
    }

    const tafsirNotes = (translationEntry?.footnotes || [])
      .filter((note) => note?.kind === 'tafsir' && String(note.text || '').trim())
      .map((note) => String(note.text).trim());

    let wordByWord = null;
    let wordByWordWords = [];
    if (includeWordByWord) {
      try {
        const result = await waitForSignal(getWordByWordTranslation(surah, ayahNumber, {
          language: wordByWordLanguage,
          signal,
        }), signal);
        wordByWordWords = result?.words || [];
        wordByWord = wordByWordWords
          .map((word) => [word.arabic, word.meaning].filter(Boolean).join(' — '))
          .filter(Boolean)
          .join('; ');
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    return {
      ayahNumber,
      arabic: String(ayah.text || ''),
      translation,
      tafsir: tafsirNotes.join('\\n'),
      tafsirNotes: (translationEntry?.footnotes || [])
        .filter((note) => note?.kind === 'tafsir' && String(note.text || '').trim())
        .map((note, index) => ({
          number: String(note.number || index + 1),
          text: String(note.text).trim(),
        })),
      wordByWord,
      wordByWordWords,
    };
  }));

  const tafsirIncluded = sourceRows.some((row) => row.tafsir);
  const now = Date.now();
  const lessonId = createLessonId();
  const surahName = getSurah(surah)?.name || `Surah ${surah}`;
  const record = {
    id: lessonId,
    surahNumber: surah,
    surahName,
    startAyah: start,
    endAyah: end,
    title: `${surahName} · ${start}–${end}`,
    content: {
      mode: 'source-led',
      prepare: {
        description: 'Answer these before studying the selected Ayahs.',
        questions: REFLECT_PREPARATION_QUESTIONS.map((text) => ({ text })),
      },
      study: {
        description: 'Read the selected Arabic and translation. Tafsir is shown only when it is available in the selected source.',
      },
    },
    answers: {
      prepare: ['', '', ''],
      final: ['', '', ''],
      notes: '',
    },
    finalQuestions: [...REFLECT_FINAL_QUESTIONS],
    sourceSnapshot: {
      verses: sourceRows,
      translationId,
      translationName: translationOption.shortName || translationOption.label,
      tafsirIncluded,
      tafsirName: tafsirIncluded ? (translationOption.shortName || translationOption.label) : null,
      outputLanguage,
      wordByWordEnabled: includeWordByWord,
      wordByWordLanguage: includeWordByWord ? wordByWordLanguage : null,
      capturedAt: now,
    },
    generation: null,
    status: 'in-progress',
    createdAt: now,
    updatedAt: now,
  };

  await saveTadabburLesson(record);
  return record;
}

function createLessonId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `reflect-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function waitForSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Study creation was cancelled.', 'AbortError'));
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Study creation timed out or was cancelled.', 'AbortError')), { once: true });
    }),
  ]);
}
