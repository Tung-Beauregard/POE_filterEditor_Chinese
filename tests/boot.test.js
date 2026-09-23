// 頁面能不能開起來。這一支要最先跑：
// 之前發生過「刪掉按鈕但沒刪綁定」導致整頁空白，語法檢查抓不到，只有真的載入才會發現。
'use strict';
const { boot, fixtures, makeReporter, cssOrphans } = require('./lib');

(async () => {
  const R = makeReporter('載入與基本流程');
  const { d, ev, click, open, errors, warns } = await boot();

  const orph = cssOrphans();
  R.ok('CSS 沒有孤兒屬性', orph.length === 0, orph.map(o => '第' + o.line + '行').join(','));
  R.ok('載入時零錯誤', errors.length === 0, errors[0] && String(errors[0]).split('\n')[0]);
  R.ok('沒有找不到元素的綁定', !warns.some(x => x.includes('[bind]')), warns.filter(x => x.includes('[bind]')).join(' / '));
  R.ok('起始畫面版本標示由 JS 填入', /^v\d/.test(d.getElementById('gateVer').textContent));
  R.ok('工具選單預設隱藏', d.defaultView.getComputedStyle(d.getElementById('toolsMenu')).display === 'none');

  for (const id of ['gateNew', 'gatePick', 'gateNS']) {
    const before = errors.length;
    click(d.getElementById(id));
    R.ok(`起始按鈕 #${id} 可點`, errors.length === before);
    d.getElementById('modal').classList.remove('on');
  }

  const fx = fixtures();
  R.ok('有測試用的過濾器', fx.length > 0, fx.map(f => f.name).join(', '));
  if (fx.length) {
    open(fx[0].text, fx[0].name);
    R.ok('開檔後區塊數 > 0', ev('state.doc.blocks.length') > 0, ev('state.doc.blocks.length'));
    R.ok('起始畫面已隱藏', d.getElementById('gate').classList.contains('off'));
    R.ok('清單已渲染', d.querySelectorAll('#list .row').length > 0);
    click(d.querySelector('#list .row'));
    R.ok('點擊區塊後 Inspector 有分區', d.querySelectorAll('#inspector .isec').length >= 5);
    R.ok('匯出與原檔逐位元組一致', ev('serializeDoc(state.doc,false)===window.__t.replace(/\\r\\n/g,state.doc.eol)'));
  }
  R.ok('全程零錯誤', errors.length === 0, errors[0] && String(errors[0]).split('\n')[0]);
  process.exit(R.done() ? 1 : 0);
})();
