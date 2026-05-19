import { getPage, getMushafPageNumber } from '../lib/quran';
import { quranRub } from '../data/quranRub';

export const surahArabicNames = [
  '', 'ٱلْفَاتِحَة', 'ٱلْبَقَرَة', 'آلِ عِمْرَان', 'ٱلنِّسَاء', 'ٱلْمَائِدَة', 'ٱلْأَنْعَام', 'ٱلْأَعْرَاف', 'ٱلْأَنْفَال', 'ٱلتَّوْبَة',
  'يُونُس', 'هُود', 'يُوسُف', 'ٱلرَّعْد', 'إِبْرَاهِيم', 'ٱلْحِجْر', 'ٱلنَّحْل', 'ٱلْإِسْرَاء', 'ٱلْكَهْف', 'مَرْيَم',
  'طه', 'ٱلْأَنْبِيَاء', 'ٱلْحَجّ', 'ٱلْمُؤْمِنُون', 'ٱلنُّور', 'ٱلْفُرْقَان', 'ٱلشُّعَرَاء', 'ٱلنَّمْل', 'ٱلْقَصَص', 'ٱلْعَنْكَبُوت',
  'ٱلرُّوم', 'لُقْمَان', 'ٱلسَّجْدَة', 'ٱلْأَحْزَاب', 'سَبَأ', 'فَاطِر', 'يس', 'ٱلصَّافَّات', 'ص', 'ٱلزُّمَر',
  'غَافِر', 'فُصِّلَت', 'ٱلشُّورَى', 'ٱلزُّخْرُف', 'ٱلدُّخَان', 'ٱلْجَاثِيَة', 'ٱلْأَحْقَاف', 'مُحَمَّد', 'ٱلْفَتْح', 'ٱلْحُجُرَات',
  'ق', 'ٱلذَّارِيَات', 'ٱلطُّور', 'ٱلنَّجْم', 'ٱلْقَمَر', 'ٱلرَّحْمَٰن', 'ٱلْوَاقِعَة', 'ٱلْحَدِيد', 'ٱلْمُجَادِلَة', 'ٱلْحَشْر',
  'ٱلْمُمْتَحِنَة', 'ٱلصَّف', 'ٱلْجُمُعَة', 'ٱلْمُنَافِقُون', 'ٱلتَّغَابُن', 'ٱلطَّلَاق', 'ٱلتَّحْرِيم', 'ٱلْمُلْك', 'ٱلْقَلَم', 'ٱلْحَاقَّة',
  'ٱلْمَعَارِج', 'نُوح', 'ٱلْجِنّ', 'ٱلْمُزَّمِّل', 'ٱلْمُدَّثِّر', 'ٱلْقِيَامَة', 'ٱلْإِنْسَان', 'ٱلْمُرْسَلَات', 'ٱلنَّبَأ', 'ٱلنَّازِعَات',
  'عَبَسَ', 'ٱلتَّكْوِير', 'ٱلْإِنْفِطَار', 'ٱلْمُطَفِّفِين', 'ٱلْإِنْشِقَاق', 'ٱلْبُرُوج', 'ٱلطَّارِق', 'ٱلْأَعْلَى', 'ٱلْغَاشِيَة', 'ٱلْفَجْر',
  'ٱلْبَلَد', 'ٱلشَّمْس', 'ٱللَّيْل', 'ٱلضُّحَى', 'ٱلشَّرْح', 'ٱلتِّين', 'ٱلْعَلَق', 'ٱلْقَدْر', 'ٱلْبَيِّنَة', 'ٱلزَّلْزَلَة',
  'ٱلْعَادِيَات', 'ٱلْقَارِعَة', 'ٱلتَّكَاثُر', 'ٱلْعَصْر', 'ٱلْهُمَزَة', 'ٱلْفِيل', 'قُرَيْش', 'ٱلْمَاعُون', 'ٱلْكَوْثَر', 'ٱلْكَافِرُون',
  'ٱلنَّصْر', 'ٱلْمَسَد', 'ٱلْإِخْلَاص', 'ٱلْفَلَق', 'ٱلنَّاس',
];

export const basmallahText = 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ';

export function getDisplayLineText(line) {
  if (line.type === 'surah_name') {
    return `سُورَةُ ${surahArabicNames[line.surahNumber] || line.surahNumber}`;
  }
  if (line.type === 'basmallah' || line.type === 'bismillah') {
    return basmallahText;
  }
  return line.text || '\u00A0';
}


export function getJuzLabel(juz) {
  const names = [
    '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
    'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
    'Twenty-first', 'Twenty-second', 'Twenty-third', 'Twenty-fourth', 'Twenty-fifth', 'Twenty-sixth', 'Twenty-seventh', 'Twenty-eighth', 'Twenty-ninth', 'Thirtieth',
  ];
  return `${names[juz] || `Juz ${juz}`} Juz`;
}


export function findRubForReference(surahNumber, ayahNumber) {
  let current = null;
  const sNo = Number(surahNumber);
  const aNo = Number(ayahNumber);
  Object.values(quranRub || {}).forEach((rub) => {
    const [startSurah, startAyah] = String(rub.first_verse_key || '').split(':').map(Number);
    if (!startSurah || !startAyah) return;
    if (compareRef(sNo, aNo, startSurah, startAyah) >= 0) current = rub;
  });
  return current;
}

export function compareRef(aSurah, aAyah, bSurah, bAyah) {
  if (Number(aSurah) !== Number(bSurah)) return Number(aSurah) - Number(bSurah);
  return Number(aAyah) - Number(bAyah);
}

export function getRubLabelForAyah(surahNumber, ayahNumber) {
  const rub = findRubForReference(surahNumber, ayahNumber);
  if (!rub?.rub_number) return '';
  const part = (Number(rub.rub_number) - 1) % 8;
  if (part === 0) return 'Hizb';
  if (part === 2) return '¼ Hizb';
  if (part === 4) return '½ Hizb';
  if (part === 6) return '¾ Hizb';
  return `Rub ${rub.rub_number}`;
}

export function getHizbLabel(page) {
  const pageData = getPage(page);
  const first = pageData.lines.find((line) => line.surahNumber && line.ayahStart);
  if (first) return getRubLabelForAyah(first.surahNumber, first.ayahStart) || 'Hizb';
  return 'Hizb';

}
