// 測試共用工具：讀取 ../index.html，提供兩種載入方式
//   headless()  純函式層，無 DOM，速度快，適合解析／序列化／資料檢查
//   boot()      用 jsdom 真的把頁面跑起來，能抓到「載入就掛掉」這類錯誤
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const FIXTURES = path.join(__dirname, 'fixtures');

function readIndex() {
  return fs.readFileSync(INDEX, 'utf8');
}

function scripts() {
  const html = readIndex();
  const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const byId = {};
  for (const m of html.matchAll(/<script id="(\w+)" type="text\/plain">([\s\S]*?)<\/script>/g)) byId[m[1]] = m[2];
  return { main: blocks[blocks.length - 1], data: byId };
}

function fixtures() {
  if (!fs.existsSync(FIXTURES)) return [];
  return fs.readdirSync(FIXTURES).filter(f => f.endsWith('.filter')).sort()
    .map(f => ({ name: f, text: fs.readFileSync(path.join(FIXTURES, f), 'utf8') }));
}

// 無 DOM 執行：把主程式當模組跑，回傳你點名要的函式與 state
function headless(exportNames) {
  const { main, data } = scripts();
  const el = () => {
    const o = { textContent: '', innerHTML: '', value: '', title: '', style: {}, dataset: {}, disabled: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, querySelector() { return el(); }, querySelectorAll() { return []; },
      insertAdjacentHTML() {}, scrollIntoView() {}, appendChild() {}, click() {}, remove() {},
      closest() { return null; }, getAttribute() { return null; }, setAttribute() {} };
    Object.defineProperty(o, 'onclick', { set() {}, get() { return null; } });
    return o;
  };
  const g = {
    document: {
      getElementById: id => data[id] != null ? { textContent: data[id] } : el(),
      querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
      createElement: () => el(), body: el(), hidden: false,
    },
    window: { addEventListener() {}, innerWidth: 1400 },
    location: { href: 'https://example.test/', protocol: 'https:', hostname: 'example.test', reload() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: async () => ({ ok: true, text: async () => '' }),
    confirm: () => true, alert() {},
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
  };
  const keys = Object.keys(g);
  const fn = new Function(...keys, main + '\nreturn {' + exportNames.join(',') + '};');
  return fn(...keys.map(k => g[k]));
}

// jsdom 執行：回傳 window、document、錯誤清單、以及在頁面 scope 執行程式碼的 ev()
function boot(opts = {}) {
  const errors = [], warns = [];
  // jsdom 的 CSS 解析器對部分現代語法會抱怨，那不是我們的錯誤；真正的 CSS 問題另由 cssOrphans() 靜態檢查
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Could not parse CSS/.test(String(e.message || e))) errors.push('jsdom: ' + (e.message || e)); });
  const dom = new JSDOM(readIndex(), {
    runScripts: 'dangerously', url: 'https://example.test/app/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.fetch = opts.fetch || (async () => ({ ok: true, text: async () => '' }));
      w.alert = () => {}; w.confirm = () => true;
      w.addEventListener('error', e => errors.push(e.error ? (e.error.stack || e.error.message) : e.message));
      w.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
      w.console.warn = (...a) => warns.push(a.join(' '));
      if (opts.beforeParse) opts.beforeParse(w);
    },
  });
  return new Promise(resolve => setTimeout(() => {
    const w = dom.window, d = w.document;
    const ev = code => { try { return w.eval(code); } catch (e) { return 'ERR:' + e.message; } };
    const click = el => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const setv = (el, v, type) => { el.value = v; el.dispatchEvent(new w.Event(type || 'input', { bubbles: true })); };
    const key = (k, o = {}) => d.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const open = (text, name) => { w.__t = text; ev('addDoc(window.__t,' + JSON.stringify(name || 'test.filter') + ')'); };
    resolve({ dom, w, d, ev, click, setv, key, open, errors, warns });
  }, 1500));
}

// 極簡斷言與報表
function makeReporter(title) {
  let pass = 0, fail = 0;
  const lines = [`\n=== ${title} ===`];
  return {
    ok(name, cond, extra) {
      cond ? pass++ : fail++;
      lines.push(`  ${cond ? '✓' : '✗'} ${name}${extra !== undefined ? '  ' + extra : ''}`);
    },
    note(s) { lines.push('  ' + s); },
    done() {
      console.log(lines.join('\n'));
      console.log(`  → ${pass} 通過，${fail} 失敗`);
      return fail;
    },
  };
}

// 靜態檢查：CSS 裡有沒有「上一行已 } 結束、這一行卻直接是 屬性:值」的孤兒屬性。
// 瀏覽器會把孤兒屬性一路吞到下一個 }，等於默默作廢一整段樣式。
function cssOrphans() {
  const m = readIndex().match(/<style>([\s\S]*?)<\/style>/);
  if (!m) return [];
  const lines = m[1].split('\n'), out = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i - 1].trimEnd().endsWith('}') && /^[a-z-]+\s*:/.test(lines[i].trim()))
      out.push({ line: i + 1, text: lines[i].trim().slice(0, 70) });
  }
  return out;
}

module.exports = { cssOrphans, ROOT, INDEX, readIndex, scripts, fixtures, headless, boot, makeReporter };
