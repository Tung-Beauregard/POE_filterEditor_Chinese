# 測試

```
npm install     第一次
npm test        全部
```

| 檔案 | 檢查什麼 | 抓過什麼 bug |
|---|---|---|
| boot.test.js | 頁面載入零錯誤、起始按鈕可點、開檔、CSS 沒有孤兒屬性 | 刪按鈕沒刪綁定造成全白；正規式砍壞 CSS |
| roundtrip.test.js | 每個 fixture 往返逐位元組一致、防呆判斷、解析邊界 | 區塊中間空行後的規則變孤兒 |
| inspector.test.js | 右側每個控制項真的改到資料、全部復原回到原檔 | |
| ui.test.js | 選單顯示與觸發、篩選、快捷鍵、內建資料筆數 | 選單 CSS 遺失導致項目攤在工具列 |

`tests/fixtures/` 放測試用的 `.filter`，目前是 NeverSink 3-STRICT（MIT）。
可以再放自己的過濾器進去，`roundtrip` 會自動跑全部。

`lib.js` 提供兩種載入：`headless()` 無 DOM 只跑函式，`boot()` 用 jsdom 真的把頁面跑起來。
會影響載入的改動一定要用 `boot()` 驗，語法檢查抓不到執行期錯誤。
