import { useEffect, useRef } from 'react';
import { saveReflectAnswerField } from '../lib/db';

/** Debounced, serialized answer persistence. Flushes when the app is backgrounded. */
export function useReflectAutosave(onError) {
  const pendingFields = useRef(new Map());
  const saveQueue = useRef(Promise.resolve());

  function flushAnswers() {
    const pending = [...pendingFields.current.values()];
    pendingFields.current.clear();
    for (const item of pending) {
      window.clearTimeout(item.timer);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveReflectAnswerField(item.lessonId, item.group, item.index, item.value))
        .catch(() => onError('Unable to save a Reflect answer. Please check device storage.'));
    }
    return saveQueue.current;
  }

  function queueAnswer(lessonId, group, index, value) {
    const key = lessonId + ':' + group + ':' + index;
    const previous = pendingFields.current.get(key);
    if (previous) window.clearTimeout(previous.timer);
    const item = { lessonId, group, index, value, timer: null };
    item.timer = window.setTimeout(() => {
      if (pendingFields.current.get(key) !== item) return;
      pendingFields.current.delete(key);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveReflectAnswerField(lessonId, group, index, value))
        .catch(() => onError('Unable to save a Reflect answer. Please check device storage.'));
    }, 300);
    pendingFields.current.set(key, item);
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAnswers();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flushAnswers();
    };
  }, []);



  return { saveQueue, flushAnswers, queueAnswer };
}
