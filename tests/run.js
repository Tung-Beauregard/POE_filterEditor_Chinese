// 依序跑所有測試，任何一支失敗就以非零結束碼結束（讓 CI 與 Claude Code 都看得懂）
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const order = ['boot', 'roundtrip', 'inspector', 'ui'];
let failed = 0;
for (const name of order) {
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.test.js')], { stdio: 'inherit', timeout: 120000 });
  if (r.status !== 0) failed++;
}
console.log(`\n${'='.repeat(40)}\n${failed ? `❌ ${failed} 支測試失敗` : '✅ 全部測試通過'}`);
process.exit(failed ? 1 : 0);
