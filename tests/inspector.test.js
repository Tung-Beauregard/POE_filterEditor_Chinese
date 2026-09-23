// 右側 Inspector 每個控制項都要真的改到資料，而且全部復原後要回到原檔。
'use strict';
const { boot, fixtures, makeReporter } = require('./lib');

(async () => {
  const R = makeReporter('Inspector 功能');
  const fx = fixtures();
  if (!fx.length) { R.ok('需要至少一個 fixture', false); process.exit(R.done() ? 1 : 0); }
  const { d, ev, click, setv, open, errors } = await boot();
  open(fx[0].text, fx[0].name);
  const orig = ev('serializeDoc(state.doc,false)');
  ev('state.sel=state.doc.blocks[0].id; renderInspector(); renderFloor();');

  for (const t of ['顯示', '標籤外觀', '數量條件', '掉落提示', '進階操作'])
    R.ok(`分區「${t}」`, [...d.querySelectorAll('.isec h4')].some(h => h.textContent.trim().startsWith(t)));

  click(d.querySelector('#showhide button[data-t="Hide"]'));
  R.ok('SHOW/HIDE', ev('state.doc.blocks[0].type') === 'Hide');
  click(d.querySelector('#showhide button[data-t="Show"]'));

  let okc = true;
  for (const k of ['SetTextColor', 'SetBackgroundColor', 'SetBorderColor']) {
    const row = d.querySelector(`.ci[data-ckey="${k}"]`); if (!row) { okc = false; continue; }
    setv(row.querySelector('.chex'), '#123456');
    if (!/18 52 86/.test(ev(`(findRule(curBlock(),'${k}')||{values:[]}).values.map(v=>v.v).join(' ')`))) okc = false;
  }
  R.ok('三色可修改', okc);
  click(d.querySelector('.ci[data-ckey="SetBorderColor"] .cclear'));
  R.ok('顏色可清除', !ev("!!findRule(curBlock(),'SetBorderColor')"));

  ev('renderInspector()');
  setv(d.querySelector('#fsNum'), '41');
  R.ok('字級數字', ev("getNum(curBlock(),'SetFontSize')") === 41);
  click(d.querySelector('#fsUp'));
  R.ok('字級 ＋', ev("getNum(curBlock(),'SetFontSize')") === 42);
  click(d.querySelector('#fsDown'));
  R.ok('字級 −', ev("getNum(curBlock(),'SetFontSize')") === 41);

  ev('renderInspector()');
  setv(d.querySelector('#borderMode'), 'text', 'change');
  R.ok('邊框跟隨文字色', ev("JSON.stringify(getColor(curBlock(),'SetBorderColor'))===JSON.stringify(getColor(curBlock(),'SetTextColor'))"));
  ev('renderInspector()');
  setv(d.querySelector('#borderMode'), 'off', 'change');
  R.ok('關閉邊框', !ev("!!findRule(curBlock(),'SetBorderColor')"));

  ev('renderInspector()');
  setv(d.querySelector('#stackLo'), '50');
  setv(d.querySelector('#stackHi'), '200');
  R.ok('數量上下限', ev('rangeText(curBlock())').includes('50') && ev('rangeText(curBlock())').includes('200'), ev('rangeText(curBlock())'));

  ev('renderInspector()');
  const mm0 = ev('!!getMinimap(curBlock())');
  click(d.querySelector('#mmToggle'));
  R.ok('小地圖開關', mm0 !== ev('!!getMinimap(curBlock())'));
  ev('renderInspector()');
  R.ok('未開啟時隱藏子設定', d.querySelector('#mmToggle').classList.contains('on') === !!d.querySelector('#mmSize'));

  const b0 = ev('!!getBeam(curBlock())');
  click(d.querySelector('#beamToggle'));
  R.ok('光柱開關', b0 !== ev('!!getBeam(curBlock())'));

  ev('renderInspector()');
  const s0 = ev("!!findRule(curBlock(),'CustomAlertSound')");
  click(d.querySelector('#sndToggle'));
  R.ok('音效開關', s0 !== ev("!!findRule(curBlock(),'CustomAlertSound')"));

  ev('renderInspector()');
  R.ok('預覽即時更新', d.querySelectorAll('#floor .gl, #floor .previewlabel').length > 0);
  R.ok('配色盤鈕', !!d.querySelector('#openPal'));
  R.ok('批次套用鈕', !!d.querySelector('#openScope'));

  ev("state.tab='src'; renderInspector();");
  R.ok('原始碼分頁', !!d.querySelector('#srcbox'));
  ev("state.tab='props'; renderInspector();");

  R.ok('輸出仍可重新解析', ev('parseDoc(serializeDoc(state.doc,false),"x").blocks.length') === ev('state.doc.blocks.length'));
  ev('while(state.undo.length) doUndo();');
  R.ok('全部復原後回到原檔（逐位元組）', ev('serializeDoc(state.doc,false)') === orig);
  R.ok('全程零錯誤', errors.length === 0, errors[0] && String(errors[0]).split('\n')[0]);
  process.exit(R.done() ? 1 : 0);
})();
