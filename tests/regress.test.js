// 回歸測試：每一項都對應一個真的發生過的 bug（多半是 v1.6–1.14 整份改寫時弄壞、v1.15 才發現的）。
// 改到相關程式時這支要維持全綠。
'use strict';
const { boot, headless, fixtures, readIndex, makeReporter } = require('./lib');

(async () => {
  const R = makeReporter('回歸：原始碼套用、比對、復原、防呆層');
  const fx = fixtures();
  if (!fx.length) { R.ok('需要至少一個 fixture', false); process.exit(R.done() ? 1 : 0); }
  // fetch 一律回傳 fixture：「與原版比對」會拿它當原版
  const { d, w, ev, click, key, open, errors } = await boot({ fetch: async () => ({ ok: true, text: async () => fx[0].text }) });
  open(fx[0].text, fx[0].name);
  const orig = ev('serializeDoc(state.doc,false)');

  // 原始碼分頁：套用要改到資料、註解行要留、沒縮排的行要補上區塊原本的縮排、復原要回到原檔
  ev('state.sel=state.doc.blocks[20].id; state.tab="src"; renderInspector();');
  const ta = d.querySelector('#srcbox');
  R.ok('原始碼分頁有套用鈕', !!d.querySelector('#applysrc'));
  ta.value = ta.value.replace(/SetFontSize\s+\d+/, 'SetFontSize 18') + '\n    # 測試註解\nMinimapIcon 1 Red Star';
  click(d.querySelector('#applysrc'));
  R.ok('套用原始碼改到字級', ev("getNum(curBlock(),'SetFontSize')") === 18);
  R.ok('沒縮排的行補上原本的縮排', ev("findRule(curBlock(),'MinimapIcon').indent") === ev('curBlock().rules.find(r=>!r.unknown&&r.key==="SetFontSize").indent'));
  R.ok('註解行保留原文', ev('curBlock().rules.some(r=>r.unknown&&/測試註解/.test(r.raw))'));
  R.ok('套用後切回屬性分頁', ev('state.tab') === 'props');
  ev('doUndo()');
  R.ok('復原後回到原檔', ev('serializeDoc(state.doc,false)') === orig);

  // 在原始碼框裡按 Ctrl+Z：交給瀏覽器，不能動到過濾器的復原紀錄
  ev('state.tab="src"; renderInspector(); snap([curBlock()],"marker");');
  const n0 = ev('state.undo.length');
  const ta2 = d.querySelector('#srcbox'); ta2.focus();
  const evz = new w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
  ta2.dispatchEvent(evz);
  R.ok('輸入框內的 Ctrl+Z 不觸發復原', !evz.defaultPrevented && ev('state.undo.length') === n0);
  ev('state.undo.pop(); syncUndo(); state.tab="props"; renderInspector();');

  // 復原紀錄跟著檔案走
  ev('snap([curBlock()],"marker2")');
  const n1 = ev('state.undo.length');
  click(d.querySelector('#files .ftab.on .fname'));
  R.ok('點目前分頁不清復原紀錄', ev('state.undo.length') === n1);
  open('Show\n    Class "Maps"\n', 'second.filter');
  R.ok('新檔案的復原紀錄是空的', ev('state.undo.length') === 0);
  click([...d.querySelectorAll('#files .ftab')].find(t => t.title === fx[0].name).querySelector('.fname'));
  R.ok('切回原檔案復原紀錄還在', ev('state.undo.length') === n1 && ev('state.doc.name') === fx[0].name);
  ev('state.undo.pop(); syncUndo();');

  // 與原版比對：走真的選單流程
  ev("putRule(state.doc.blocks[10],'SetFontSize',[20])");
  click(d.getElementById('toolsBtn'));
  click(d.querySelector('#toolsMenu [data-tool="diffBtn"]'));
  R.ok('比對對話框會建議對應的嚴格度', /3-STRICT/.test((d.querySelector('#modalBody .nsrow.on .nsf') || {}).textContent || ''));
  click(d.querySelector('#modalBody .nsrow.on'));
  await new Promise(r => setTimeout(r, 1500));
  const tabs = [...d.querySelectorAll('.dftabs button')].map(b => b.textContent);
  R.ok('比對結果有四個分頁且抓到一筆差異', tabs.length === 4 && /^已修改1$/.test(tabs[0]), tabs.join(' / ') || d.getElementById('dfStatus')?.textContent);
  click(d.querySelector('.dfrow [data-take="theirs"]'));
  R.ok('改用原版會把字級改回去', ev("getNum(state.doc.blocks[10],'SetFontSize')") !== 20);
  d.getElementById('modal').classList.remove('on');

  // 防呆層：帶 Continue 的無條件 Show 是全域樣式層，不是防呆層，修復不能搬走它
  open(['Show # 全域字級', '    SetFontSize 40', '    Continue', '', 'Show', '    Class "Currency"', '', 'Hide', '    Rarity Normal', ''].join('\n'), 'continue.filter');
  R.ok('Continue 區塊不是防呆層候選', ev('safetyState().b') === null);
  ev("snapDoc('t'); applySafetyStyle(ensureSafetyLayer().b);");
  const lines = ev('serializeDoc(state.doc,false)').split('\n');
  R.ok('修復後全域區塊還在最前面', /^Show # 全域字級/.test(lines[0]) && lines[2].trim() === 'Continue');
  R.ok('修復後防呆層有效', ev('safetyState().ok') === true);

  // 防呆層：檔尾是無條件 Hide 又沒有兜底 Show，補在檔尾也是死規則，要建在 Hide 前面
  open(['Show', '    Class "Currency"', '', 'Hide', '    SetFontSize 18', ''].join('\n'), 'hide-end.filter');
  const s0 = ev('JSON.stringify({b:!!safetyState().b,blockers:safetyState().blockers.length})');
  R.ok('沒有候選時把檔尾的 Hide 當攔截者', s0 === '{"b":false,"blockers":1}', s0);
  ev('openSafetyManager()');
  R.ok('面板改成「在它前面新增防呆層」', /在它前面新增防呆層/.test((d.getElementById('safetyOverride') || {}).textContent || ''));
  click(d.getElementById('safetyOverride'));
  R.ok('新防呆層建在 Hide 前面', ev('safetyState().ok') === true && ev('state.doc.blocks[state.doc.blocks.length-1].type') === 'Hide');

  // Esc 關對話框；連結資料夾對話框的路徑要顯示反斜線（JS 字串要寫成 \\）
  ev('openAbout()');
  key('Escape');
  R.ok('Esc 關閉對話框', !d.getElementById('modal').classList.contains('on'));
  R.ok('資料夾路徑的反斜線有跳脫', /<code>文件\\\\My Games\\\\Path of Exile\\\\<\/code>/.test(readIndex()));

  // 匯出前提醒：全檔檢查有錯誤時要先提醒，而且不能改動檔案
  open('Show\n    Class "Currency"\n    MinimapIcon 0 Magenta Star\n', 'bad-icon.filter');
  const before = ev('serializeDoc(state.doc,false)');
  ev('download(false)');
  R.ok('全檔檢查有錯誤時匯出先提醒', d.getElementById('modal').classList.contains('on') && !!d.getElementById('dlLint'));
  R.ok('提醒不會改動檔案', ev('serializeDoc(state.doc,false)') === before);
  d.getElementById('modal').classList.remove('on');

  R.ok('全程零錯誤', errors.length === 0, errors[0] && String(errors[0]).split('\n')[0]);

  // 關鍵字與提示音檢查（無 DOM）
  const R2 = makeReporter('關鍵字與提示音檢查');
  const M = headless(['parseDoc', 'state', 'lint', 'NS_LEVELS', 'ruleIndent', 'putRule', 'serializeDoc']);
  const lintOf = t => { const doc = M.parseDoc(t, 'x'); M.state.doc = doc; return M.lint(doc.blocks[0]).map(i => i.lv + ':' + i.msg); };
  R2.ok('ElderMap 是合法關鍵字', !lintOf('Show\n    ElderMap True\n').some(m => /不認得/.test(m)));
  R2.ok('PoE2 專屬關鍵字有專屬提示', lintOf('Show\n    WaystoneTier >= 1\n').some(m => /流亡黯道 2/.test(m)));
  R2.ok('PlayAlertSound 編號檢查', lintOf('Show\n    Class "Maps"\n    PlayAlertSound 17 300\n').some(m => /^e:.*音效編號/.test(m)));
  R2.ok('PlayAlertSound 音量檢查', lintOf('Show\n    Class "Maps"\n    PlayAlertSound 1 301\n').some(m => /^e:.*音量/.test(m)));
  R2.ok('塑者語音名稱合法', !lintOf('Show\n    Class "Maps"\n    PlayAlertSound ShDivine 300\n').some(m => /^e:/.test(m)));
  R2.ok('Rarity 值檢查', lintOf('Show\n    Rarity Legendary\n').some(m => /^e:.*Rarity/.test(m)));
  R2.ok('自訂音效假路徑是錯誤', lintOf('Show\n    Class "Maps"\n    CustomAlertSound "音效資料夾\\檔名.mp3"\n').some(m => /^e:/.test(m)));
  R2.ok('NeverSink 有 0-SOFT', M.NS_LEVELS.some(L => L.f === '0-SOFT'));
  const tabDoc = M.parseDoc('Show\n\tClass "Maps"\n', 'x'); M.state.doc = tabDoc;
  M.putRule(tabDoc.blocks[0], 'SetFontSize', [40]);
  R2.ok('新規則跟著既有規則用 Tab 縮排', M.serializeDoc(tabDoc, false) === 'Show\n\tClass "Maps"\n\tSetFontSize 40\n');

  process.exit((R.done() + R2.done()) ? 1 : 0);
})();
