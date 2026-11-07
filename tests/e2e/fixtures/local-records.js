export async function seedLocalRecords(page) {
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('quranFluentLocal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['bookmarks', 'highlights', 'tadabburLessons'], 'readwrite');
    const now = Date.now();
    transaction.objectStore('bookmarks').put({
      id: 990001, category: 'Reading', surahNumber: 1, ayahNumber: 1,
      page: 1, preview: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', createdAt: now, updatedAt: now,
    });
    transaction.objectStore('highlights').put({
      id: 990002, color: '#FACC15', surahNumber: 1, ayahNumber: 2,
      page: 1, preview: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', createdAt: now, updatedAt: now,
    });
    transaction.objectStore('tadabburLessons').put({
      id: 'qa-reflect-lesson', surahNumber: 1, startAyah: 1, endAyah: 3,
      title: 'QA saved lesson', status: 'saved', createdAt: now, updatedAt: now,
      answers: { prepare: ['', '', ''], tadabbur: { imagine: 'QA persistence note' } },
      finalQuestions: [],
      sourceSnapshot: {
        translationId: 'en-sahih', translationName: 'QA translation',
        wordByWordLanguage: 'en',
        verses: [
          { ayahNumber: 1, arabic: 'بِسْمِ اللَّهِ', text: 'بِسْمِ اللَّهِ', translation: 'In the name of Allah', wordByWordWords: [], tafsirNotes: [] },
          { ayahNumber: 2, arabic: 'الْحَمْدُ لِلَّهِ', text: 'الْحَمْدُ لِلَّهِ', translation: 'All praise is for Allah', wordByWordWords: [], tafsirNotes: [] },
          { ayahNumber: 3, arabic: 'الرَّحْمَٰنِ الرَّحِيمِ', text: 'الرَّحْمَٰنِ الرَّحِيمِ', translation: 'The Most Compassionate, Most Merciful', wordByWordWords: [], tafsirNotes: [] },
        ],
      },
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
}

