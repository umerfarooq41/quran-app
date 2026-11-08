import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const baselineDirectory = process.env.QURAN_BASELINE_DIRECTORY || '/tmp/quran-ui-original';
const vite = path.resolve('node_modules/vite/bin/vite.js');
import { spawn } from 'node:child_process';
const servers = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'}),
  spawn(process.execPath, [vite,'preview','--host','127.0.0.1','--port','4175','--strictPort'],{cwd:baselineDirectory,stdio:'ignore'}),
];
for (const port of [4173,4175]) { let ready=false;for(let i=0;i<60;i++){try { if((await fetch(`http://127.0.0.1:${port}`)).ok){ready=true;break;} }catch { /* Server is starting. */ }await new Promise(resolve=>setTimeout(resolve,100));}if(!ready)throw new Error(`Server ${port} unavailable`); }
import { chromium } from '@playwright/test';
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
function summarize(themes) {
 return Object.fromEntries(Object.entries(themes).map(([theme,capture])=>[theme,{
   sha256:createHash('sha256').update(JSON.stringify(capture)).digest('hex'),
   padding:capture.padding,grid:capture.grid,pageRect:capture.rect,
   wordAndMarkerCount:capture.words.length,highlightCount:capture.highlights.length,capsuleCount:capture.capsules.length,
 }]));
}
const results=[];
const outputPath = process.env.QURAN_GEOMETRY_OUTPUT || 'docs/css-audit/independent-reader-geometry.json';
try {
 for (const width of [320,375,390,430,768]) for (const pageNumber of [1,7,238,239,548]) {
  const captures=[];
  for (const port of [4175,4173]) {
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage();await page.goto(`http://127.0.0.1:${port}`);
   await page.getByRole('heading',{name:'Al Quran'}).waitFor();
   await page.evaluate(async pageNumber=>{
    const database=await new Promise((resolve,reject)=>{const request=indexedDB.open('quranFluentLocal');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{const tx=database.transaction(['lastRead','bookmarks','highlights'],'readwrite');tx.objectStore('lastRead').put({id:'current',page:pageNumber,surahNumber:1,ayahNumber:1,updatedAt:Date.now()});if(pageNumber===7){
      for(const [i,color] of ['amber','emerald','rose','sky','violet'].entries())tx.objectStore('highlights').put({id:9000+i,surahNumber:2,ayahNumber:42+i,color,page:7});
      for(const [i,category] of ['Reading','Memorize','Reflect','Notes'].entries())tx.objectStore('bookmarks').put({id:9100+i,surahNumber:2,ayahNumber:42+i,category,page:7});
    }tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});database.close();
   },pageNumber);
   await page.goto(`http://127.0.0.1:${port}/?audit=${pageNumber}`);await page.getByRole('heading',{name:'Al Quran'}).waitFor();
   await page.getByRole('button',{name:/Continue Reading/i}).click();
   await page.locator('.reader-page').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
   if(pageNumber===7) await page.locator('.reader-ayah-highlight-saved').first().waitFor({state:'attached'});
   await page.waitForTimeout(250);
   const themes = {};
   for (const theme of ['light','dark']) {
   await page.evaluate(theme => {document.documentElement.dataset.theme = theme;},theme);
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   themes[theme] = await page.locator('.reader-page').first().evaluate(root=>{
    const rect=el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100);};
    return {padding:getComputedStyle(root).padding,grid:getComputedStyle(root).gridTemplateRows,rect:rect(root),text:root.textContent,words:[...root.querySelectorAll('.quran-word,.quran-ayah-marker')].map(el=>({text:el.textContent,rect:rect(el),font:getComputedStyle(el).fontSize})),
      highlights:[...root.querySelectorAll('svg path')].map(el=>({path:el.getAttribute('d'),rect:rect(el),fill:getComputedStyle(el).fill})),
      capsules:[...root.querySelectorAll('.quran-ayah-marker--quarter,.quran-ayah-marker--bookmark')].map(el=>{const s=getComputedStyle(el,'::after');return {rect:rect(el),width:s.width,height:s.height,color:s.backgroundColor,border:s.borderColor,transform:s.transform};})};
   });
   }
   captures.push(themes);await context.close();
  }
  results.push({width,pageNumber,identical:JSON.stringify(captures[0])===JSON.stringify(captures[1]),before:summarize(captures[0]),after:summarize(captures[1])});
  fs.writeFileSync(outputPath,JSON.stringify({baseline:'33a2c4c',results},null,2));
  console.log(width,pageNumber,results.at(-1).identical?'MATCH':'DIFFERENCE');
 }
 fs.writeFileSync(outputPath,JSON.stringify({baseline:'33a2c4c',results},null,2));
 if(results.some(r=>!r.identical))process.exitCode=1;
} finally { await browser.close(); servers.forEach(server=>server.kill()); }
