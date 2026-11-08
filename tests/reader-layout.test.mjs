import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReaderLayout, readerSpreadStart } from '../src/features/reader/hooks/useReaderLayout.js';

test('Reader auto layout requires landscape space for two readable portrait pages', () => {
  for (const [width,height] of [[320,640],[390,844],[768,1024],[820,1180],[844,390],[1365,500]]) {
    assert.equal(resolveReaderLayout(width,height).spread, false, `${width}x${height}`);
  }
  for (const [width,height] of [[1024,768],[1180,820],[1280,800],[1365,900],[1440,900],[1920,1080]]) {
    const layout=resolveReaderLayout(width,height);
    assert.equal(layout.spread,true);
    assert.ok(layout.pageWidth>=360 && layout.pageWidth<=576);
    assert.ok(layout.pageWidth*2+24<=width);
    assert.ok(layout.pageHeight<=height);
    assert.equal(layout.pageWidth/layout.pageHeight,0.64);
  }
});
test('Reader pairs pages only in spreads, including the 8-to-9 boundary',()=>{
  assert.deepEqual([1,2,3,4,7,8,9,10,547,548].map(readerSpreadStart),[1,1,3,3,7,7,9,9,547,547]);
});
