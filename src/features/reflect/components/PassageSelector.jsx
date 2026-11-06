import React from 'react';
import { getSurah, getSurahAyahs } from '../../../lib/quran';
import ReflectRangePicker from './ReflectRangePicker';
import { getInitialReflectRange } from '../reflectRules';
import { reflectCardClass as card } from '../reflectPresentation';

/** Passage selection with compact range controls. Range validity is provided by the page. */
export default function PassageSelector({ surah, surahNumber, setSurahNumber, startAyah, setStartAyah, endAyah, setEndAyah, ayahs, count, validRange, rangePicker, setRangePicker }) {
  return (
        <div className={card + ' reflect-passage-selector'}>
          <div className="reflect-passage-heading">
            <h2 className="font-semibold">Passage</h2>
            <span className="reflect-passage-limit">3–15 ayahs</span>
          </div>
          <ReflectRangePicker label="Surah" value={surahNumber} display={surahNumber + '. ' + (surah?.name || '')}
            options={Array.from({length:114},(_,i)=>getSurah(i+1)).filter(Boolean).map(item=>({value:item.number,label:item.number+'. '+item.name}))}
            open={rangePicker==='surah'} onToggle={()=>setRangePicker(current=>current==='surah'?null:'surah')}
            onSelect={value=>{setSurahNumber(value);setStartAyah(1);setEndAyah(Math.min(3,getSurahAyahs(value).length));setRangePicker(null);}}/>
          <div className="reflect-passage-range">
            <ReflectRangePicker label="From" value={startAyah} options={ayahs.map(item=>({value:item.ayahNumber,label:String(item.ayahNumber)}))}
              open={rangePicker==='from'} onToggle={()=>setRangePicker(current=>current==='from'?null:'from')}
              onSelect={value=>{const range=getInitialReflectRange(value,ayahs.length);setStartAyah(range?.startAyah||value);setEndAyah(range?.endAyah||value);setRangePicker(null);}}/>
              <ReflectRangePicker label="To" value={endAyah} options={ayahs.filter(item=>item.ayahNumber>=startAyah&&item.ayahNumber<=startAyah+14).map(item=>({value:item.ayahNumber,label:String(item.ayahNumber)}))}
              open={rangePicker==='to'} onToggle={()=>setRangePicker(current=>current==='to'?null:'to')}
              onSelect={value=>{setEndAyah(value);setRangePicker(null);}}/>
          </div>
          <p role="status" aria-live="polite" className={'reflect-passage-status '+(validRange?'is-valid':'is-invalid')}>{validRange ? count+' ayahs selected' : 'Select 3–15 ayahs'}</p>

        </div>
  );
}
