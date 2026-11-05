/** Pure calculations for the Reflect progress dashboard. */
export function getReflectProgress(lessons, progressPeriod, now = new Date()) {
  const start = new Date(now);
  if (progressPeriod === 'week') {
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
  }
  if (progressPeriod === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  const filtered = progressPeriod === 'all' ? lessons : lessons.filter(lesson => {
    const date = new Date(lesson.updatedAt || lesson.createdAt || 0);
    return !Number.isNaN(date.getTime()) && date >= start && date <= now;
  });
  const completed = filtered.filter(lesson => lesson.status === 'completed');
  const percentage = filtered.length ? Math.round(completed.length / filtered.length * 100) : 0;
  const ayahKeys = new Set(filtered.flatMap(lesson => Array.from({
    length: Math.max(0, (Number(lesson.endAyah) || 0) - (Number(lesson.startAyah) || 0) + 1),
  }, (_, index) => lesson.surahNumber + ':' + (Number(lesson.startAyah) + index))));
  const questions = filtered.flatMap(lesson => lesson.studyQuestions || []);
  const answered = questions.filter(question => Boolean(String(question.answer || '').trim())).length;
  const commitments = completed.filter(lesson => String(lesson.answers?.tadabbur?.commitment || lesson.answers?.tadabbur?.plan || '').trim());
  const recent = [...filtered].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 3);
  return { filtered, completed, percentage, ayahCount: ayahKeys.size, questions, answered, commitments, recent };
}
