import React, { useEffect, useRef } from 'react';
import { QuranLine } from './QuranLine';

const SELECTION_HIGHLIGHT = 'reader-ayah-selection';

export function MushafPage({
  pageData,
  settings,
  markedRefs,
  pendingAyah,
  selectedAyah,
  activeAudioAyah,
  onSelectAyah,
}) {
  const pageRef = useRef(null);
  const supportsTextHighlights = typeof CSS !== 'undefined' && Boolean(CSS.highlights) && typeof Highlight !== 'undefined';

  useEffect(() => {
    if (!supportsTextHighlights) return undefined;

    CSS.highlights.delete(SELECTION_HIGHLIGHT);

    if (!selectedAyah || !pageRef.current) return undefined;

    const ranges = pageData.lines.flatMap((line) => {
      if (!lineContainsAyah(line, selectedAyah)) return [];

      const textElement = pageRef.current.querySelector(`[data-quran-line="${line.line}"] .quran-line-text`);
      const textNode = textElement?.firstChild;
      const offsets = getAyahOffsets(line, selectedAyah.ayahNumber);

      if (!textNode || !offsets) return [];

      const range = new Range();
      range.setStart(textNode, offsets.start);
      range.setEnd(textNode, offsets.end);
      return [range];
    });

    if (ranges.length) {
      CSS.highlights.set(SELECTION_HIGHLIGHT, new Highlight(...ranges));
    }

    return () => {
      CSS.highlights.delete(SELECTION_HIGHLIGHT);
    };
  }, [pageData, selectedAyah, supportsTextHighlights]);

  return (
    <div
      ref={pageRef}
      className="reader-page grid flex-1 grid-rows-16 overflow-hidden px-4"
      style={{ '--font-scale': settings.fontScale }}
    >
      {pageData.lines.map((line, index) => {
        const nextLine = pageData.lines[index + 1];
        const hasSeparateBasmallah = nextLine?.type === 'basmallah' || nextLine?.type === 'bismillah';

        return (
          <QuranLine
            key={line.line}
            line={line}
            hasSeparateBasmallah={hasSeparateBasmallah}
            onSelect={(ayahNumber) => onSelectAyah(line, ayahNumber)}
            marked={line.ayahStart ? markedRefs.has(`${line.surahNumber}:${line.ayahStart}`) : false}
            selected={!supportsTextHighlights && lineContainsAyah(line, selectedAyah)}
            jumped={Boolean(
              pendingAyah &&
                line.surahNumber === pendingAyah.surahNumber &&
                line.ayahStart <= pendingAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
            )}
            activeAudio={Boolean(
              activeAudioAyah &&
                line.surahNumber === activeAudioAyah.surahNumber &&
                line.ayahStart <= activeAudioAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= activeAudioAyah.ayahNumber)
            )}
          />
        );
      })}
    </div>
  );
}

function lineContainsAyah(line, selectedAyah) {
  return Boolean(
    selectedAyah &&
      line.type === 'ayah' &&
      line.surahNumber === selectedAyah.surahNumber &&
      line.ayahStart <= selectedAyah.ayahNumber &&
      line.ayahEnd >= selectedAyah.ayahNumber
  );
}

function getAyahOffsets(line, ayahNumber) {
  const relativeAyah = Number(ayahNumber) - Number(line.ayahStart);
  if (relativeAyah < 0) return null;

  const markerOffsets = [];
  const markerPattern = /[\uE000-\uF8FF]/g;
  let match = markerPattern.exec(line.text);

  while (match) {
    markerOffsets.push(match.index);
    match = markerPattern.exec(line.text);
  }

  let start = relativeAyah === 0
    ? 0
    : (markerOffsets[relativeAyah - 1] ?? -1) + 1;
  const endMarker = markerOffsets[relativeAyah];
  const end = endMarker === undefined ? line.text.length : endMarker + 1;

  while (start < end && /\s/.test(line.text[start])) start += 1;

  return start < end ? { start, end } : null;
}
