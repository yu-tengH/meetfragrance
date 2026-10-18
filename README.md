# 香遇幸福 產品展示網站（Astro 範例）

只負責「展示」商品：購買連到 7-11 賣貨便，詢問連到 LINE 官方帳號。沒有金流和會員系統，所以不用處理資安和個資。

## 本機執行

```bash
npm install
npm run dev      # 開發模式，打開 http://localhost:4321
npm run build    # 產生正式網站到 dist/
```

## 檔案結構

```
src/
  data/products.csv      範例產品資料（沒接試算表時用這份）
  lib/products.js        讀產品資料：試算表 → 解析 → 給頁面用
  lib/site.js            LINE、賣貨便連結 ← 先改這裡
  layouts/Base.astro     每一頁共用的頁首、頁尾
  components/            商品卡片、沒照片時的圖示
  pages/
    index.astro          首頁
    products/index.astro 全部商品（可依分類篩選）
    products/[slug].astro 單一商品頁（每個商品自動產生一頁）
public/images/           去背好的產品照
```

## 接上 Google 試算表（讓姑姑自己改商品）

1. 建一份 Google 試算表，第一列放這些欄位（直接複製 `src/data/products.csv` 的第一列）：
   `代號, 品名, 分類, 價格, 香味, 適合, 使用方式, 規格, 照片, 購買連結, 首頁精選, 上架`
   - **代號**：英文小寫，例如 `peony`，會變成網址 `/products/peony/`，設好後不要再改
   - **分類**：`擴香石`、`香氛精油`、`護唇膏`
   - **價格**：只填數字；空白會顯示「價格請私訊詢問」
   - **照片**：Google 雲端硬碟的分享連結（要設成「知道連結的人都能查看」）
   - **購買連結**：該商品的賣貨便連結；空白就連到 `site.js` 裡的賣場
   - **代號**可以留空：用 Google 表單新增的商品，會用「時間戳記」自動產生網址
   - **首頁精選**：填「是」才會出現在首頁
   - **上架**：填「否」就會從網站隱藏（不用刪掉那一列）；留空或填「是」都會顯示
2. 檔案 → 共用 → 發佈到網路 → 選該工作表、格式選 **CSV** → 發佈，複製網址
3. 部署平台設定環境變數 `SHEET_CSV_URL` = 剛剛的網址

### 照片上傳（給姑姑用）

建一份 Google 表單，題目跟試算表欄位一樣，「照片」用「檔案上傳」題型，回覆連到同一份試算表。姑姑用手機填表單就能新增商品和上傳照片。

## 3D 預覽（選用）

商品頁會在試算表的「3D模型」欄有填東西時，才出現「看 3D」按鈕。按下去才會下載 3D 檢視器和模型，不影響頁面速度；手機上還會出現「在我的空間查看」用 AR 看實際大小。

1. 用手機 App 掃描商品，匯出 **GLB** 格式
2. 檔案盡量壓在 5 MB 以下：`npx @gltf-transform/cli optimize 原檔.glb peony.glb --texture-compress webp`
3. 把檔案放到 `public/models/`
4. 試算表「3D模型」欄填檔名，例如 `peony.glb`（也可以填完整網址）
5. 推上 GitHub 就會更新

注意：GLB 不能放 Google 雲端硬碟，瀏覽器讀不到，要放在 `public/models/` 裡。
`public/models/garden-girl.glb` 只是用照片做的示範卡片，不是真的掃描。

## 加入主畫面（PWA）

已經設定好 `public/manifest.webmanifest` 和圖示（`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`）。
網站上線後，用手機打開：
- iPhone（Safari）：分享按鈕 → 加入主畫面
- Android（Chrome）：右上角選單 → 加到主畫面／安裝應用程式

想換圖示的話，換掉 `public/` 裡那幾張 PNG 就好（尺寸要一樣）。

## 換店主照片

1. 把新照片（建議去背的 PNG 或 WebP）放到 `public/images/`
2. 改 `src/lib/site.js` 裡的 `ownerPhoto`，例如 `'/images/aunt-new.png'`

## 網站沒顯示商品？

看執行 `npm run dev` 的終端機，會有一行 `[products] 從試算表讀到 N 列，顯示 M 個商品`，被略過的列也會寫原因。改了 `.env` 之後要按 Ctrl + C 停掉再重新 `npm run dev`。

## 部署（免費）：Cloudflare Pages

1. 把專案推到 GitHub
2. Cloudflare Pages → 連接 GitHub repo
   - Build command：`npm run build`
   - Output directory：`dist`
   - 環境變數：`SHEET_CSV_URL`、`NODE_VERSION` = `22`
3. 之後每次 push 就會自動更新網站

### 試算表改完後更新網站

網站是在「建置」時讀試算表的，所以改完試算表要重新建置一次。做法：

1. Cloudflare Pages → 設定 → 建置 → 新增 **Deploy hook**，複製網址
2. 在試算表 → 擴充功能 → Apps Script，貼上：

```js
function onOpen() {
  SpreadsheetApp.getUi().createMenu('香遇幸福').addItem('更新網站', 'updateSite').addToUi();
}
function updateSite() {
  UrlFetchApp.fetch('貼上 Deploy hook 網址', { method: 'post' });
  SpreadsheetApp.getUi().alert('已送出，大約 1–2 分鐘後網站會更新。');
}
```

姑姑改完試算表後，按上方選單「香遇幸福 → 更新網站」就好。想要全自動的話，也可以在 Apps Script 設「觸發條件」，每天凌晨自動執行一次。

## 上線前要改的地方

- `src/lib/site.js`：LINE 加好友連結、賣貨便賣場連結
- `astro.config.mjs`：`site` 換成正式網址
- 首頁「品牌故事」那段文字（目前是佔位）
- 商品文案避免寫醫療效果（例如助眠、治療、抗菌），改用描述氛圍和感受的說法
