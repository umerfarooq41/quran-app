import React from 'react';
import { QuranLine } from './QuranLine';

export function MushafPage({ pageData, settings, markedRefs, pendingAyah, onSelectLine }) {
  return (
    <div
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
            onSelect={() => onSelectLine(line)}
            marked={line.ayahStart ? markedRefs.has(`${line.surahNumber}:${line.ayahStart}`) : false}
            jumped={Boolean(
              pendingAyah &&
                line.surahNumber === pendingAyah.surahNumber &&
                line.ayahStart <= pendingAyah.ayahNumber &&
                (!line.ayahEnd || line.ayahEnd >= pendingAyah.ayahNumber)
            )}
          />
        );
      })}
    </div>
  );
}
