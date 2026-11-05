import React from 'react';

/** Reader-style inline footnote references; toggles only the selected Tafsir note. */
export default function renderReflectTranslation(value, notes, onToggle, selectedNumber) {
  const text = String(value || "");
  const available = new Set((notes || []).map(note => Number(note.number)).filter(Number.isFinite));
  return text.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match || !available.has(Number(match[1]))) return <React.Fragment key={index}>{part}</React.Fragment>;
    const number = Number(match[1]);
    return <button key={index} type="button" className={"ayah-translation-inline-footnote" + (selectedNumber === number ? " is-active" : "")}
      dir="ltr" lang="en" aria-pressed={selectedNumber === number} aria-label={"Toggle Tafsir footnote " + number}
      onClick={() => onToggle(number)}>{number}</button>;
  });
}
