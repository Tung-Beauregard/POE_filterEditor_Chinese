// 每個 fixture 過濾器：解析後再輸出必須逐位元組相同，防呆層必須正確判斷。
// 這是最重要的不變量。任何解析器或序列化的改動都要過這關。
'use strict';
const { headless, fixtures, makeReporter } = require('./lib');

const M = headless(['parseDoc', 'serializeDoc', 'state', 'safetyState', 'lintGroups', 'classify']);
const R = makeReporter('往返一致與防呆層');

for (const f of fixtures()) {
  const d = M.parseDoc(f.text, f.name);
  M.state.doc = d;
  for (const b of d.blocks) { b._cat = null; b._t = null; }
  const same = M.serializeDoc(d, false) === f.text.replace(/\r\n/g, d.eol);
  const s = M.safetyState();
  const lint = M.lintGroups().reduce((a, g) => a + g.n, 0);
  R.ok(`${f.name}  往返一致`, same);
  R.ok(`${f.name}  防呆層判斷不崩潰`, typeof s.ok === 'boolean', `ok=${s.ok} 攔截者=${s.blockers.length}`);
  R.note(`   區塊 ${d.blocks.length}，章節 ${d.sections.length}，檢查項 ${lint}`);
}

// 解析邊界：這些寫法都必須往返一致
const R2 = makeReporter('解析邊界');
const rt = (name, t, expectBlocks) => {
  const d = M.parseDoc(t, 'x'); M.state.doc = d;
  const same = M.serializeDoc(d, false) === t.replace(/\r\n/g, d.eol);
  const cnt = expectBlocks == null || d.blocks.length === expectBlocks;
  R2.ok(name, same && cnt, `區塊 ${d.blocks.length}`);
  return d;
};
rt('空檔案', '', 0);
rt('只有註解', '# a\n# b\n', 0);
rt('Tab 縮排', 'Show\n\tClass "Maps"\n', 1);
rt('行尾註解', 'Show\n    Class "Maps" # 註解\n', 1);
rt('值含井號', 'Show\n    BaseType "Item #1"\n', 1);
rt('CRLF', 'Show\r\n    Class "Maps"\r\n', 1);
rt('無結尾換行', 'Show\n    Class "Maps"', 1);
rt('否定條件', 'Show\n    BaseType != "Chaos Orb"\n', 1);
rt('Continue', 'Show\n    Class "Maps"\n    Continue\n', 1);
rt('區塊之間空行不可誤併', 'Show\n    Class "Maps"\n\nShow\n    Class "Gems"\n', 2);
const d1 = rt('區塊中間空行仍屬同一區塊', 'Show\n    Class "Maps"\n\n    SetFontSize 40\n', 1);
R2.ok('  空行後的規則有被認到', !!d1.blocks[0].rules.find(r => !r.unknown && r.key === 'SetFontSize'));

process.exit((R.done() + R2.done()) ? 1 : 0);
