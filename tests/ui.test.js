// 工具列選單、中央篩選、快捷鍵、內建資料。
'use strict';
const { boot, headless, fixtures, makeReporter } = require('./lib');

(async () => {
  const R = makeReporter('選單、篩選、快捷鍵');
  const fx = fixtures();
  const { d, w, ev, click, setv, key, open, errors, warns } = await boot();
  const disp = id => w.getComputedStyle(d.getElementById(id)).display;

  click(d.getElementById('toolsBtn'));
  R.ok('工具選單可展開', disp('toolsMenu') === 'block');
  click(d.body);
  R.ok('點外面收起', disp('toolsMenu') === 'none');
  R.ok('選單有分組標題', d.querySelectorAll('#toolsMenu .mgrp').length >= 4);

  if (fx.length) {
    open(fx[0].text, fx[0].name);
    let failed = [];
    for (const it of [...d.querySelectorAll('#toolsMenu [data-tool]')]) {
      const before = errors.length;
      click(d.getElementById('toolsBtn')); click(it);
      if (errors.length !== before) failed.push(it.dataset.tool);
      d.getElementById('modal').classList.remove('on');
    }
    R.ok('選單每一項都可觸發', failed.length === 0, failed.join(',') || `${d.querySelectorAll('#toolsMenu [data-tool]').length} 項`);

    click(d.querySelector('#vissw button[data-v="hide"]'));
    R.ok('HIDE 篩選', ev('visibleBlocks().every(b=>b.type==="Hide")'));
    click(d.querySelector('#vissw button[data-v="all"]'));
    const cnts = [...d.querySelectorAll('#vissw button b')].map(x => +x.textContent);
    R.ok('分段控制有數量', cnts.length === 3 && cnts[0] === cnts[1] + cnts[2], cnts.join('/'));

    setv(d.querySelector('#q'), 'zzz_no_such_item_zzz');
    await new Promise(r => setTimeout(r, 250));
    R.ok('搜尋無結果有空狀態', /找不到符合/.test(d.querySelector('#list').innerHTML));
    click(d.querySelector('#clearQ'));
    R.ok('清除搜尋', ev('state.query') === '');

    key('f', { ctrlKey: true });
    R.ok('Ctrl+F 聚焦搜尋', d.activeElement === d.querySelector('#q'));
    d.querySelector('#q').blur();
    click(d.getElementById('railBtn'));
    R.ok('收合左側', d.querySelector('.stage').classList.contains('norail'));
    click(d.getElementById('railBtn'));
  }
  R.ok('沒有找不到元素的綁定', !warns.some(x => x.includes('[bind]')));
  R.ok('全程零錯誤', errors.length === 0, errors[0] && String(errors[0]).split('\n')[0]);

  const R2 = makeReporter('內建資料');
  const M = headless(['NAMES', 'CARDS', 'STACKCAP', 'tr', 'cardInfo']);
  R2.ok('譯名 > 4000 筆', Object.keys(M.NAMES).length > 4000, Object.keys(M.NAMES).length);
  R2.ok('命運卡 > 400 張', Object.keys(M.CARDS).length > 400, Object.keys(M.CARDS).length);
  R2.ok('堆疊上限 > 500 種', Object.keys(M.STACKCAP).length > 500, Object.keys(M.STACKCAP).length);
  R2.ok('抽查譯名 Orb of Annulment → 無效石', M.tr('Orb of Annulment') === '無效石', M.tr('Orb of Annulment'));
  R2.ok('抽查命運卡 The Apothecary', !!M.cardInfo('The Apothecary') && M.cardInfo('The Apothecary').unique, JSON.stringify(M.cardInfo('The Apothecary')));
  R2.ok('命運卡撇號容錯', !!M.cardInfo("Akil's Prophecy"));
  R2.ok('資料表沒有空名稱列', !Object.keys(M.STACKCAP).some(k => !k.trim()) && !Object.keys(M.NAMES).some(k => !k.trim()));

  process.exit((R.done() + R2.done()) ? 1 : 0);
})();
