// 產品資料來源：
// 1. 有設定環境變數 SHEET_CSV_URL（Google 試算表「發佈到網路」的 CSV 網址）→ 讀試算表
// 2. 沒設定或讀取失敗 → 讀 src/data/products.csv（範例資料）
import LOCAL_CSV from '../data/products.csv?raw';

// 試算表欄位（中文表頭，讓姑姑看得懂）→ 程式內部欄位
const COLUMNS = {
  代號: 'slug',
  品名: 'name',
  分類: 'category',
  價格: 'price',
  香味: 'scent',
  適合: 'goodFor',
  使用方式: 'usage',
  規格: 'spec',
  照片: 'image',
  購買連結: 'buyUrl',
  首頁精選: 'featured',
  上架: 'visible',
  '3D模型': 'model',
};

// 3D 模型：填檔名（放在 public/models/，例如 peony.glb）或完整網址
function toModelUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v) || v.startsWith('/')) return v;
  return `/models/${v}`;
}

// 簡單的 CSV 解析（支援雙引號包住的欄位、欄位內逗號與換行）
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// Google 雲端硬碟分享連結 → 可以直接顯示的圖片網址
// （照片要設成「知道連結的人都能查看」）
function toImageUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
  return v;
}

const yes = (v) => ['是', 'y', 'yes', 'true', 'v', '1', '✓'].includes((v || '').trim().toLowerCase());
// 「上架」只有明確填「否」才隱藏；沒有這一欄或留空都當作上架
const hidden = (v) => ['否', 'n', 'no', 'false', '0', '下架'].includes((v || '').trim().toLowerCase());

// 表頭比對：去掉空白和 BOM，允許題目後面多加說明，例如「照片（請上傳）」
const COLUMN_NAMES = Object.keys(COLUMNS).sort((a, b) => b.length - a.length);
function headerKey(h) {
  const clean = h.replace(/^﻿/, '').replace(/\s+/g, '');
  const hit = COLUMN_NAMES.find((name) => clean.startsWith(name));
  return hit ? COLUMNS[hit] : clean;
}

function toProducts(csvText, source) {
  const text = csvText.replace(/^﻿/, '');
  if (/^\s*</.test(text)) {
    throw new Error('拿到的是網頁不是 CSV。發佈到網路時格式要選「逗號分隔值 (.csv)」，網址結尾應該是 output=csv');
  }
  const rows = parseCsv(text);
  // 表頭不一定在第一列（例如試算表「表格」功能會多一列標題），找含有「品名」的那一列
  const headerIndex = rows.findIndex((r) => r.some((c) => headerKey(c) === 'name'));
  if (headerIndex === -1) {
    throw new Error(`找不到「品名」欄位。目前讀到的第一列是：${(rows[0] || []).join(' | ')}`);
  }
  const keys = rows[headerIndex].map(headerKey);
  const body = rows.slice(headerIndex + 1);

  const products = [];
  body.forEach((cells, i) => {
    const p = Object.fromEntries(keys.map((k, j) => [k, (cells[j] || '').trim()]));
    // 代號沒填：用 Google 表單的「時間戳記」自動產生（例如 item-20261017142750）
    if (!p.slug && p['時間戳記']) {
      const d = p['時間戳記'].match(/\d+/g) || [];
      p.slug = 'item-' + d.map((n) => n.padStart(2, '0')).join('');
    }
    const rowNo = headerIndex + i + 2;
    if (!p.name) return console.warn(`[products] 第 ${rowNo} 列沒有品名，略過`);
    if (!p.slug) return console.warn(`[products] 第 ${rowNo} 列「${p.name}」沒有代號也沒有時間戳記，略過`);
    if (hidden(p.visible)) return console.log(`[products] 第 ${rowNo} 列「${p.name}」設為不上架`);
    products.push(p);
  });
  console.log(`[products] 從${source}讀到 ${body.length} 列，顯示 ${products.length} 個商品`);

  return products
    .map((p) => ({
      ...p,
      slug: p.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      image: toImageUrl(p.image),
      model: toModelUrl(p.model),
      featured: yes(p.featured),
      priceLabel: p.price ? `NT$ ${p.price.replace(/[^\d]/g, '')}` : '價格請私訊詢問',
    }));
}

let cache;
export async function getProducts() {
  // 開發模式（npm run dev）每次重新整理都重讀，改完試算表馬上看得到
  if (cache && !import.meta.env.DEV) return cache;
  const url = import.meta.env.SHEET_CSV_URL || process.env.SHEET_CSV_URL;
  if (url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = toProducts(await res.text(), '試算表');
      return cache;
    } catch (err) {
      console.warn(`[products] 讀不到試算表，改用範例資料：${err.message}`);
    }
  }
  cache = toProducts(LOCAL_CSV, '範例資料');
  return cache;
}

export const CATEGORIES = ['擴香石', '香氛精油', '護唇膏'];
