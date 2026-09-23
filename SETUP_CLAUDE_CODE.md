# 接到 Claude Code

## 1. 把這包放進 repo

解壓後把所有檔案覆蓋到本機的 `POE_filterEditor_Chinese` 資料夾（含 `.github/`）。
`index.html` 是最新版 v1.14.1，修了一個線上版本存在的 CSS 語法錯誤。

## 2. 安裝

需要 Node.js 18 以上與 Python 3。

```
npm install -g @anthropic-ai/claude-code
cd POE_filterEditor_Chinese
npm install
npm test
```

四支測試全綠再往下。

## 3. 開始

```
claude
```

第一次可以直接說「讀 CLAUDE.md 然後跑 npm test 確認環境」。
它每次開啟都會自動讀 `CLAUDE.md`，那裡有這個專案的所有約定與踩過的坑。

## 4. 之後怎麼合作

- 要它改東西時，它會先跑測試、改、再跑測試。四支都要綠。
- 它改 UI 之後如果頁面開不起來，`npm run test:boot` 會直接指出第幾行。
- 有新的約定或它犯了同樣的錯，直接說「把這條寫進 CLAUDE.md」。

## 5. 資料更新

```
npm run data:check     看上游有沒有新譯名
npm run data:update    更新並寫回
```

GitHub 上的 Action 每週一自動跑，有更新會開 PR。
