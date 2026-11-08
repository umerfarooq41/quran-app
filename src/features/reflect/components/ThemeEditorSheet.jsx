import { SearchField } from '../../../components/common/SearchField';
import React from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { reflectActionClass as action, reflectFieldClass as field } from '../reflectPresentation';
import { Sheet } from '../../../components/common/Surfaces';

/** Theme selection and creation sheet; state is owned by the Reflect page. */
export default function ThemeEditorSheet({ themeCreation, setThemeCreation, setThemeSheet, newThemeName, setNewThemeName, createTheme, themeSearch, setThemeSearch, themeGroups, expandedTheme, setExpandedTheme, draftThemes, toggleThemeSub, toggleThemeMain, finishThemeEditing }) {
  return (
<div className="fixed inset-0 z-[100] flex items-end bg-black/40" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setThemeSheet(false);}}>
          <Sheet onClose={() => setThemeSheet(false)} className="reflect-theme-sheet flex max-h-[85dvh] w-full flex-col rounded-t-2xl shadow-xl" ariaLabel="Edit themes">
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-300"/>
            {themeCreation ? <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{themeCreation.type === 'main' ? 'New Main Theme' : 'New Subtheme'}</h3><button type="button" aria-label="Back to themes" onClick={()=>setThemeCreation(null)}><X size={20}/></button></div>
              {themeCreation.type === 'sub' && <p className="text-sm reflect-muted-text">Under {themeCreation.parent}</p>}
              <input className={field} autoFocus aria-label="Theme name" placeholder="Theme name" value={newThemeName} onChange={e=>setNewThemeName(e.target.value)}/>
              <button type="button" className={action} disabled={!newThemeName.trim()} onClick={createTheme}>Create {themeCreation.type === 'main' ? 'Main Theme' : 'Subtheme'}</button>
            </div> : <>
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3"><h3 className="font-semibold">Themes</h3><div className="flex items-center gap-3"><button type="button" className="reflect-secondary-action inline-flex items-center gap-1 text-xs font-semibold" onClick={()=>{setThemeCreation({type:'main'});setNewThemeName('');}}><Plus size={14}/> Main Theme</button><button type="button" aria-label="Close themes" onClick={()=>setThemeSheet(false)}><X size={20}/></button></div></div>
              <div className="shrink-0 px-4 pb-3"><SearchField value={themeSearch} onChange={setThemeSearch} placeholder="Search themes…" label="Search themes"/></div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
                <div className="reflect-theme-picker-list">{Object.entries(themeGroups).filter(([main,subs])=>main.toLowerCase().includes(themeSearch.toLowerCase())||subs.some(sub=>sub.toLowerCase().includes(themeSearch.toLowerCase()))).map(([main,subs])=><div key={main} className="reflect-theme-picker-group">
                  <button type="button" className="reflect-theme-picker-heading" aria-expanded={expandedTheme===main} onClick={()=>setExpandedTheme(expandedTheme===main?null:main)}>{main}<ChevronDown size={17} className={expandedTheme===main?'reflect-theme-chevron is-open':'reflect-theme-chevron'}/></button>
                  {(expandedTheme===main||themeSearch.trim()) && <div className="reflect-theme-picker-content"><div className="flex flex-wrap gap-2">{subs.filter(sub=>!themeSearch||main.toLowerCase().includes(themeSearch.toLowerCase())||sub.toLowerCase().includes(themeSearch.toLowerCase())).map(sub=><button key={sub} type="button" aria-pressed={draftThemes.some(item=>item.main===main&&item.sub.includes(sub))} className={'reflect-theme-choice '+(draftThemes.some(item=>item.main===main&&item.sub.includes(sub))?'is-selected':'')} onClick={()=>toggleThemeSub(main,sub)}>{sub}</button>)}<button type="button" className="reflect-theme-choice reflect-theme-new inline-flex items-center gap-1" onClick={()=>{setThemeCreation({type:'sub',parent:main});setNewThemeName('');}}><Plus size={13}/> New</button></div><button type="button" className="reflect-secondary-action mt-3 text-xs" onClick={()=>toggleThemeMain(main)}>{draftThemes.some(item=>item.main===main)?'Remove main theme':'Select main theme only'}</button></div>}
                </div>)}</div>
              </div>
              <div className="reflect-theme-sheet-footer flex shrink-0 items-center justify-between border-t px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"><span className="text-xs reflect-muted-text">{draftThemes.length} themes selected</span><button type="button" className={action} onClick={finishThemeEditing}>Done</button></div>
            </>}
          </Sheet>
        </div>
  );
}
