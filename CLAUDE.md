# AUD 期貨當沖決策輔助系統

澳幣期貨（台灣期交所 AD，券商元大）當沖用的決策輔助工具。單一 HTML 檔，CSS/JS 全部內嵌，部署到 GitHub Pages：`sky53531-hue.github.io/aud-trading/`。

使用者是室內設計師兼開發者兼期貨當沖交易者，主要用繁體中文溝通，常從手機（iPhone PWA）操作。

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 整個 App。所有 CSS/JS 內嵌，不要拆檔 |
| `sw.js` | Service Worker。HTML 走 network-first（靠 `request.mode === 'navigate'` 判斷），靜態資源 cache-first，API 請求不攔截 |
| `manifest.json` | PWA manifest，`start_url: /aud-trading/` |

資料全存 localStorage，沒有後端。`PLAN` 以日曆日為 key（`aud_plan_<YYYY-MM-DD>`）。

## 交易策略：三重確認

三層同向才進場，任一層不過就是觀望。對應 `calcLayer1/2/3`：

| 層級 | 判定 | 需要的輸入 |
|---|---|---|
| ① 日線方向 | 突破前日高→偏多、跌破前日低→偏空 | 前日高 / 前日低 |
| ② 15分結構 | 站上開盤區間高→偏多、跌破低→偏空 | 開盤區間高 / 低 |
| ③ 5分觸發 | 收紅站穩（多）/ 收黑跌破（空），量增為強觸發 | 5分K棒型態按鈕 |

`calcLayer3(patterns, dir)` 的 `dir` 來自第①層，所以**①沒方向時③必定不過**。這是刻意的，不是 bug。

時段：主盤 20:00–01:00、副盤 06:00–08:00、觀盤 15:00 起。

## AI 判圖：最重要的一條規則

**AI 只負責抄圖上印出來的文字，方向判斷一律由引擎計算。**

這是踩過坑換來的。看盤軟體 header 只顯示「當前那一根」K 棒的開高低收，前日高低和開盤區間在圖上**沒有文字形式**。早期版本讓 AI 判斷方向，它就去量 K 棒像素、捏造數字（把今日高低直接抄成前日高低），然後基於假數字說「收盤價高於前一日高點」——那天其實跌了 46 點。AI 卡片和決策引擎講的話互相矛盾，使用者完全失去信任。

現在的分工：

- **AI 可靠讀取**：`currentPrice`、`todayHigh`、`todayLow`（都在 header 那一列）、`kPatterns`（5分K型態，視覺判斷）、`imagesSeen`（逐張回報有沒有讀到）
- **AI 一律回 null**：`prevDayHigh/Low`、`openRangeHigh/Low`——prompt 明確要求寧可填 null 也不要猜
- **使用者手動填**：前日高低、開盤區間高低。每天填一次即可（整個交易時段不變）。`analyzeImages` 開頭會先 `confirm()` 擋下，避免白花 API 額度

`renderAIResult` 用**跟引擎同一套** `calcLayer1/2/3` 計算卡片內容，所以卡片和決策引擎不可能講不同的話。AI 回傳的 JSON 裡沒有 `finalSignal`/`layer1~3`/`summary` 這些判斷欄位，不要加回去。

`pick(v, fallbackId)` 負責取值：AI 有給就用 AI 的，沒給就退回表單既有值。另有防呆——AI 若把 `prevDayHigh` 填成等於 `todayHigh` 就直接丟棄。

## Gemini API 的坑

使用者用免費的 Google Gemini（`CFG.aiProvider='gemini'`）。這個 API 狀態很亂，`analyzeImages` 裡的 fallback 迴圈是必要的，不要簡化：

1. `/v1beta/models` 列出來「可用」的模型，實際呼叫可能回 `no longer available to new users`
2. 那個錯誤訊息裡會指定替代模型（例如 `gemini-3.6-flash`），程式用 regex 抓出來自動重試
3. 替代模型可能只在 `v1` 而不在 `v1beta`，所以兩個 endpoint 都要試
4. `responseMimeType: 'application/json'` 不是每個模型都支援，要有「不加這參數」的退路
5. 503 / `high demand` 是暫時性的，會退避重試 2 次再換下一個模型

`parseAIJson()` 會修補被 token 上限截斷的 JSON（補上未閉合的引號和括號），因為模型常在輸出到一半被切斷。改動它時記得跑截斷案例的測試。

圖片在 `processFile` 用 canvas 壓到 768px / JPEG 65%，iPhone 截圖約 3MB → 220KB。

## 改動後必做

**每次改 `index.html` 或 `sw.js`，一定要把 `sw.js` 的 `CACHE` 版號 +1**（`aud-v15` → `aud-v16`）。忘了的話手機上的 PWA 不會更新，使用者會以為你沒修。

推上去後告訴使用者：**設定 → 強制清除快取並更新 → 重開 App**。

驗證方式（這個專案沒有測試框架，用 node 一次性腳本即可）：

```bash
# 語法檢查
node -e "var js=(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)||[])[1];new Function(js);console.log('OK')"
```

也可以把 `calcLayer1/2/3` 或 `renderAIResult` 用 `eval` 抽出來、配 DOM stub 實際跑一遍，確認三層判定和渲染結果正確——改決策邏輯或版面時建議這樣驗，比用眼睛看可靠。

## 溝通

用繁體中文。使用者同時是設計師 / 開發者 / 交易者，技術細節可以直說。遇到技術選型直接給建議並說明原因，不用每次反問。
