import { getSurahAyahs, getSurah } from '../../lib/quran';
import { getTranslationOption, loadTranslationEntry } from '../../lib/translations';
import { getWordByWordTranslation } from '../quranFoundation/words';
import { generateTadabburLesson } from './generateTadabburLesson';
import { saveTadabburLesson } from '../../lib/db';

export const TADABBUR_FINAL_QUESTIONS = Object.freeze([
  'What is the most important thing you learned from these Ayahs?',
  'What did these Ayahs make you reflect on about yourself?',
  'What is one thing you want to remember or apply from this lesson?',
]);

/**
 * Load the user's current Quran sources, generate a lesson, and save a
 * self-contained snapshot locally. Existing lessons never need to be
 * regenerated when Settings change.
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
  if (end - start + 1 > 15) {
    throw new Error('A Tadabbur lesson can contain at most 15 Ayahs.');
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
  const includeWordByWord = Boolean(appSettings.wordByWordTranslation);
  const wordByWordLanguage = appSettings.wordByWordLanguage === 'ur' ? 'ur' : 'en';

  const sourceRows = await Promise.all(selectedAyahs.map(async (ayah) => {
    if (signal?.aborted) throw new DOMException('Generation was cancelled.', 'AbortError');

    const ayahNumber = Number(ayah.ayahNumber);
    const translationEntry = await loadTranslationEntry(
      translationId,
      surah,
      ayahNumber,
      { includeTafsir: true, signal },
    );
    const translation = String(translationEntry?.plainText || '').trim();
    if (!translation) {
      throw new Error(`Translation is unavailable for ${surah}:${ayahNumber}. Check your connection and try again.`);
    }

    const tafsirNotes = (translationEntry?.footnotes || [])
      .filter((note) => note?.kind === 'tafsir' && String(note.text || '').trim())
      .map((note) => String(note.text).trim());

    let wordByWord = null;
    if (includeWordByWord) {
      try {
        const result = await getWordByWordTranslation(surah, ayahNumber, {
          language: wordByWordLanguage,
          signal,
        });
        wordByWord = (result?.words || [])
          .map((word) => [word.arabic, word.meaning].filter(Boolean).join(' — '))
          .filter(Boolean)
          .join('; ');
      } catch (error) {
        if (signal?.aborted) throw error;
        // Word-by-word data is an optional aid. It must not block a lesson
        // when the chosen language's word resource is temporarily unavailable.
      }
    }

    return {
      ayahNumber,
      arabic: String(ayah.text || ''),
      translation,
      tafsir: tafsirNotes.join('\n'),
      wordByWord,
      translationEntry,
    };
  }));

  const tafsirText = sourceRows
    .filter((row) => row.tafsir)
    .map((row) => `Ayah ${surah}:${row.ayahNumber}\n${row.tafsir}`)
    .join('\n\n');

  const wordByWordText = sourceRows
    .filter((row) => row.wordByWord)
    .map((row) => `Ayah ${surah}:${row.ayahNumber}\n${row.wordByWord}`)
    .join('\n\n');

  const generated = await generateTadabburLesson({
    surahNumber: surah,
    startAyah: start,
    endAyah: end,
    translationName: translationOption.shortName || translationOption.label,
    tafsirName: tafsirText ? (translationOption.shortName || translationOption.label) : '',
    outputLanguage,
    wordByWordLanguage: includeWordByWord ? wordByWordLanguage : null,
    verses: sourceRows.map(({ ayahNumber, arabic, translation }) => ({
      ayahNumber,
      arabic,
      translation,
    })),
    tafsirText,
    wordByWordText,
  }, { signal });

  const now = Date.now();
  const lessonId = createLessonId();
  const record = {
    id: lessonId,
    surahNumber: surah,
    surahName: getSurah(surah)?.name || '',
    startAyah: start,
    endAyah: end,
    title: generated.lesson.title,
    content: generated.lesson,
    answers: {
      prepare: ['', '', ''],
      final: ['', '', ''],
    },
    finalQuestions: [...TADABBUR_FINAL_QUESTIONS],
    sourceSnapshot: {
      verses: sourceRows.map((row) => ({
        ayahNumber: row.ayahNumber,
        arabic: row.arabic,
        translation: row.translation,
        tafsir: row.tafsir || null,
        wordByWord: row.wordByWord || null,
      })),
      translationId,
      translationName: translationOption.shortName || translationOption.label,
      tafsirIncluded: Boolean(tafsirText),
      tafsirName: tafsirText ? (translationOption.shortName || translationOption.label) : null,
      outputLanguage,
      wordByWordEnabled: includeWordByWord,
      wordByWordLanguage: includeWordByWord ? wordByWordLanguage : null,
    },
    generation: {
      provider: 'google-gemini',
      model: generated.model,
      generatedAt: generated.generatedAt,
      promptVersion: 2,
    },
    status: 'in-progress',
    createdAt: now,
    updatedAt: now,
  };

  await saveTadabburLesson(record);
  return record;
}

function createLessonId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `tadabbur-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
