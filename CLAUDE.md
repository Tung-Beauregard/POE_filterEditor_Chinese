# POE 過濾器編輯器

流亡黯道 1（台服）的繁體中文掉落過濾器編輯器。單一 `index.html`，無框架、無建置步驟，部署在 GitHub Pages。

## 開始工作前

1. 跑 `npm test`。四支測試都要綠，尤其 `boot`（頁面能不能載入）。
2. 改完任何東西再跑一次 `npm test`，全綠才算完成。
3. 每次改動都要把 `APP_VERSION` 與 `APP_BUILD`（在主 `<script>` 最前面）往上調。更新偵測靠正規式讀這兩行，所以它們必須留在程式最前面。

## 檔案結構

```
index.html                 整個應用。四個 <script>：namedata、carddata、stackdata（純資料）、主程式
tests/                     jsdom 測試，npm test 執行
tests/fixtures/*.filter    測試用過濾器，可自行放更多
tools/update-data.py       從上游重抓譯名與堆疊上限並寫回 index.html
.github/workflows/         每週檢查上游資料，有更新就開 PR
README_防呆與操作說明.md    使用者說明，工具選單裡的「說明」連到它
LICENSE                    MIT，附第三方資料授權清單
```

主程式內部依序分成：資料表載入 → 分類（TAX）→ 解析與序列化 → 區塊工具 → 防呆檢查 → 狀態與復原 → 繪製 → 事件 → 各功能對話框 → 版本偵測。

## 不可打破的不變量

**往返一致**：`serializeDoc(parseDoc(text))` 必須與原文逐位元組相同（僅換行統一）。沒改過的規則行保留 `raw`，只有 `dirty` 的規則才重新序列化。任何解析器或序列化的修改都要用 fixtures 驗證。

**規則物件不可原地修改**：所有異動走 `patchRule` / `putRule` / `dropRule`，它們會建新物件與新陣列。復原系統靠這個共用未變動的規則，改成原地修改會讓快照互相污染，而且記憶體會爆。

**只寫遊戲支援的語法**：不要發明 PoE 不接受的關鍵字或參數。`CustomAlertSound` 沒有音量參數（音量屬於 `PlayAlertSound`）。字級 18–45。`StackSize` 可在同一區塊寫兩條形成範圍（NeverSink 對 ItemLevel 就這樣用）。不確定就去 `tests/fixtures` 的真實檔案裡找有沒有人這樣寫。

**防呆層的定義**：最後一條無條件 `Show`，且前面沒有任何無條件規則攔截它。判斷靠結構（`safetyState()`），不靠註解文字，所以改名不會讓舊檔失效。同一條規則不可同時被防呆面板說正確、又被全檔檢查報錯。

**匯出不改檔**：`download()` 不得自動修改過濾器。有問題只能提醒，由使用者決定。

## 曾經踩過的坑

這些都真的發生過，且都讓頁面整個開不起來或默默壞掉：

- **刪按鈕沒刪綁定**：`$('#x').addEventListener` 在元素不存在時丟 TypeError，整份程式停在那行，頁面全白。現在頂層綁定一律用 `bind()`，找不到只留 console.warn。刪 UI 元素時仍要把對應的 `bind` 與 `TOOL_ACTIONS` 項目一起清掉。
- **正規式清 CSS 砍到多行規則的第一行**：留下孤兒屬性，瀏覽器會吞到下一個 `}`，一整段樣式默默失效。`tests/boot.test.js` 有 `cssOrphans()` 檢查。改 CSS 用精確字串取代，不要用寬鬆的正規式。
- **測試用假 DOM 對任何 id 都回傳空物件**：所以抓不到 null 錯誤。現在用 jsdom 真的載入，`tests/lib.js` 的 `boot()`。
- **重複的 `id`**：兩顆按鈕同 id，第二顆點了沒反應。
- **檔名策略**：寫入遊戲資料夾要沿用原檔名直接覆蓋（遊戲裡不用重選）；瀏覽器下載才加 `_edited` 後綴。

## 資料來源與更新

| 區塊 | 來源 | 授權 | 更新方式 |
|---|---|---|---|
| namedata | Awakened PoE Trade `cmn-Hant`（台服客戶端字串） | MIT | `tools/update-data.py` |
| stackdata | RePoE `base_items` | MIT | 同上 |
| carddata | maps-of-exile（張數、英文獎勵）+ 人工對照 poedb.tw 的繁中獎勵 | MIT | **獎勵譯文無法自動更新**，腳本只會回報新卡 |

`update-data.py` 只增不減：上游會刪掉已從遊戲移除的物品，但過濾器往往還在用，所以舊譯名一律保留。也會排除 AREA 與 MERCENARY_BUILD 這種不是掉落物的命名空間。

## 文案與用語

- 全部繁體中文，台服用語。物品名以遊戲內為準，不要自己翻。
- NeverSink 是社群作者，**不是官方**。「官方」只用於「台服官方譯名」。
- 不要出現任何真錢交易平台的名稱或連結。
- 介面文字避免單字按鈕（例如「繁」），看不懂。

## 設計語言

黑金、低飽和、工具型。CSS 變數在 `:root`（`--gold`、`--gold-hi`、`--gold-dim`、`--rule`、`--muted`、`--faint`、`--show`、`--hide`、`--warn`）。標題用系統中文字型（`--ui`），Marcellus SC 只用於裝飾性英文。不要圓角、不要漸層藍紫、不要外部圖示庫。

三欄結構：左分類 Rail、中規則列表（主工作區）、右 Inspector。Inspector 分五區：顯示 → 標籤外觀 → 數量條件 → 掉落提示 → 進階操作。掉落提示用漸進揭露，沒開啟就不顯示子設定。

## 外部連線

只有三處，全部是唯讀：
- `raw.githubusercontent.com` 抓 NeverSink 過濾器（回 `Access-Control-Allow-Origin: *`，可直接 fetch）
- 抓自己的 `index.html` 比對版本
- 使用者主動連結資料夾後，寫入 `.filter` 到該資料夾（File System Access API，Chrome/Edge）

不上傳任何資料。不加需要後端或 API 金鑰的功能，靜態頁面放不住密鑰。

## 常用指令

```
npm test              全部測試
npm run test:boot     只測載入（最快，改 UI 後先跑這個）
npm run data:check    檢查上游資料有無更新，不寫檔
npm run data:update   更新資料並寫回 index.html
```
