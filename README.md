# W.RINES 魅力探索測驗 — GitHub Pages 版

這是由原始 `w_rines.tsx` 整理成的 **Vite + React** 專案，可直接放到 GitHub，並透過 GitHub Actions 發布到 GitHub Pages。

## 你最快的發布方式

1. 在 GitHub 建立一個新的 Repository，例如：`w-rines`。
2. 將此資料夾內的**所有檔案與資料夾**上傳到 Repository 根目錄。
3. 確認預設分支叫 `main`。
4. GitHub Repository → **Settings → Pages**。
5. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
6. 回到 **Actions**，等待 `Deploy W.RINES to GitHub Pages` 完成。
7. 完成後，網站網址通常是：`https://你的帳號.github.io/w-rines/`。

> `vite.config.js` 已經會自動判斷 Repository 名稱，不需要手動改 `base`。

## 本機測試（選填）

需要 Node.js 20 或更新版本：

```bash
npm install
npm run dev
```

正式測試 build：

```bash
npm run build
npm run preview
```

## 目前公開版可以做什麼？

即使完全不設定 Firebase / Google Sheet / AI proxy：

- 首頁可正常開啟
- 34 題問卷可作答
- Power / Freedom / Warmth 可計分
- 可產生原本程式已有的標準魅力分析結果
- 結果頁與珠寶建議可以顯示

未設定外部服務時：

- 不會寫入 Firestore
- 不會送資料到 Google Sheet
- AI 會自動切換為原程式的標準分析模式
- 後台預設停用

## Firebase（選填）

若要把問卷結果寫入 Firebase，請到 GitHub Repository：

**Settings → Secrets and variables → Actions → Variables → New repository variable**

依序建立：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_COLLECTION_ID`（可填 `rines-charm-app`）

Firebase 前端 config 並不是用來當密碼；真正的資料讀寫安全必須靠 **Firestore Security Rules**。

另外請在 Firebase Authentication 啟用 **Anonymous sign-in**，否則匿名登入會失敗。

## Google Sheet（選填）

若要沿用 Google Apps Script Web App，把網址放到 Repository Variable：

`VITE_GOOGLE_SHEET_WEBHOOK_URL`

例如：

`https://script.google.com/macros/s/.../exec`

這個網址會出現在網站前端，因此請把 Apps Script 視為公開接收端，並自行做好資料驗證與防濫用設計。

## AI 分析（重要）

原始檔案把 Gemini API Key 直接寫在 React 前端。這在公開網站上是不安全的，因為任何訪客都能從打包後的 JavaScript 找到它。

這個 GitHub 版已經把 Gemini API Key 從程式碼中移除。

若要重新啟用真正的 AI 分析，請建立一個**伺服器端 proxy**，並把 proxy 網址設成：

`VITE_AI_PROXY_URL`

前端會送出：

```json
{
  "prompt": "...W.RINES 分析 prompt..."
}
```

後端應回傳：

```json
{
  "charmName": "開界",
  "charmTitle": "VANGUARD",
  "charmDesc": "...",
  "aboutYou": "...",
  "tags": ["...", "...", "..."],
  "jewelry": {
    "line": "...",
    "size": "...",
    "weight": "...",
    "shine": "...",
    "testMatch": ["...", "...", "..."],
    "avoid": ["...", "...", "..."],
    "stylingSuggestion": "..."
  }
}
```

也可以包成 `{ "profile": { ... } }`。

**不要建立 `VITE_GEMINI_API_KEY`。任何 `VITE_*` 值都會被放進公開前端 bundle。**

## 後台安全

原始程式的管理者密碼直接寫在 React 程式中，因此任何人都可能查看原始碼找到密碼。此版本預設把公開後台登入停用。

如果只是本機展示，可以在 `.env` 設：

```bash
VITE_DEMO_ADMIN_PASSWORD=你的測試密碼
```

但**不建議在 GitHub Pages 正式網站使用這種方式**。正式後台請改用 Firebase Authentication，並以 Firestore Rules 限制管理者讀取權限。

## 圖片注意事項

原始第 20–23 題使用 Facebook CDN 圖片網址。這些外部圖片連結未來可能失效。正式發布前，建議將圖片下載到 `public/images/`，再把題目中的圖片網址改成本地相對路徑。

## 安全提醒

原始檔案曾包含一組 Gemini API Key。即使現在已從此專案移除，也建議到原本的 API 管理平台**撤銷該 Key 並重新建立新的 Key**，因為已暴露過的 Key 不應繼續使用。
