/**
 * Furkan Güven — Makale Yönetimi API
 * VDS'te çalışan minimal Node.js HTTP sunucusu
 *
 * Kurulum:
 *   npm install          (mevcut package.json yeterli, sadece Node.js gerekli)
 *   ADMIN_TOKEN=güçlübirtokenyaz PORT=3001 node api/server.js
 *
 * Nginx proxy (örnek):
 *   location /api/ { proxy_pass http://localhost:3001/api/; }
 *
 * Endpoint'ler:
 *   GET  /api/admin/verify           — Token doğrula
 *   GET  /api/articles               — Makale listesi (public)
 *   GET  /api/articles/:slug         — Tekil makale (public)
 *   POST /api/admin/article          — Yeni makale oluştur (auth)
 *   PUT  /api/admin/article/:slug    — Makale güncelle (auth)
 *   DELETE /api/admin/article/:slug  — Makale sil (auth)
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

/* ── Ayarlar ── */
const PORT         = process.env.PORT || 3001;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || '';
const SITE_ROOT    = path.resolve(__dirname, '..');
const DATA_DIR     = path.join(SITE_ROOT, 'makaleler', 'data');
const INDEX_FILE   = path.join(DATA_DIR, 'index.json');

if (!ADMIN_TOKEN) {
  console.error('HATA: ADMIN_TOKEN çevre değişkeni ayarlanmamış!');
  console.error('Örnek: ADMIN_TOKEN=güçlübirtokenyaz node api/server.js');
  process.exit(1);
}

/* ── CORS başlıkları ── */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/* ── Yardımcılar ── */
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(body);
}

function sendError(res, status, msg) {
  send(res, status, { error: msg });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 2e6) reject(new Error('Çok büyük')); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Geçersiz JSON')); }
    });
    req.on('error', reject);
  });
}

function authCheck(req) {
  const header = req.headers['authorization'] || '';
  const token  = header.replace(/^Bearer\s+/i, '');
  return token === ADMIN_TOKEN;
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveIndex(articles) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(articles, null, 2), 'utf8');
}

function slugSafe(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function articleFile(slug) {
  return path.join(DATA_DIR, slug + '.json');
}

/* ── Sunucu ── */
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/$/, '');
  const method   = req.method.toUpperCase();

  // Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  /* ── Token doğrulama ── */
  if (method === 'GET' && pathname === '/api/admin/verify') {
    if (!authCheck(req)) return sendError(res, 401, 'Yetkisiz');
    return send(res, 200, { ok: true });
  }

  /* ── Makale listesi (public) ── */
  if (method === 'GET' && pathname === '/api/articles') {
    const articles = loadIndex();
    return send(res, 200, articles);
  }

  /* ── Tekil makale (public) ── */
  const articleMatch = pathname.match(/^\/api\/articles\/([a-z0-9-]+)$/);
  if (method === 'GET' && articleMatch) {
    const slug = articleMatch[1];
    const file = articleFile(slug);
    if (!fs.existsSync(file)) return sendError(res, 404, 'Makale bulunamadı');
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return send(res, 200, data);
    } catch {
      return sendError(res, 500, 'Dosya okunamadı');
    }
  }

  /* ── Admin: Yeni makale oluştur ── */
  if (method === 'POST' && pathname === '/api/admin/article') {
    if (!authCheck(req)) return sendError(res, 401, 'Yetkisiz');
    let article;
    try { article = await readBody(req); }
    catch (e) { return sendError(res, 400, e.message); }

    if (!article.title || !article.slug || !article.body) {
      return sendError(res, 400, 'title, slug ve body zorunludur');
    }

    article.slug = slugSafe(article.slug);
    const file = articleFile(article.slug);

    if (fs.existsSync(file)) {
      return sendError(res, 409, 'Bu slug zaten mevcut: ' + article.slug);
    }

    // JSON dosyasını kaydet
    const { body, ...meta } = article;
    fs.writeFileSync(file, JSON.stringify(article, null, 2), 'utf8');

    // index.json güncelle
    const articles = loadIndex();
    articles.unshift({ ...meta, body: undefined });
    // body'yi index'e ekleme — sadece metadata
    const cleanMeta = { slug: meta.slug, title: meta.title, description: meta.description,
      date: meta.date, tags: meta.tags || [], readingTime: meta.readingTime || 5 };
    articles[0] = cleanMeta;
    saveIndex(articles);

    console.log('[POST] Makale oluşturuldu:', article.slug);
    return send(res, 201, { ok: true, slug: article.slug });
  }

  /* ── Admin: Makale güncelle ── */
  const adminArticleMatch = pathname.match(/^\/api\/admin\/article\/([a-z0-9-]+)$/);
  if (method === 'PUT' && adminArticleMatch) {
    if (!authCheck(req)) return sendError(res, 401, 'Yetkisiz');
    const oldSlug = adminArticleMatch[1];
    let article;
    try { article = await readBody(req); }
    catch (e) { return sendError(res, 400, e.message); }

    article.slug = slugSafe(article.slug || oldSlug);
    const newFile = articleFile(article.slug);
    const oldFile = articleFile(oldSlug);

    // JSON dosyasını kaydet
    fs.writeFileSync(newFile, JSON.stringify(article, null, 2), 'utf8');

    // Slug değiştiyse eski dosyayı sil
    if (article.slug !== oldSlug && fs.existsSync(oldFile)) {
      fs.unlinkSync(oldFile);
    }

    // index.json güncelle
    let articles = loadIndex();
    const idx = articles.findIndex(a => a.slug === oldSlug);
    const cleanMeta = { slug: article.slug, title: article.title, description: article.description,
      date: article.date, tags: article.tags || [], readingTime: article.readingTime || 5 };

    if (idx !== -1) {
      articles[idx] = cleanMeta;
    } else {
      articles.unshift(cleanMeta);
    }
    saveIndex(articles);

    console.log('[PUT] Makale güncellendi:', article.slug);
    return send(res, 200, { ok: true, slug: article.slug });
  }

  /* ── Admin: Makale sil ── */
  if (method === 'DELETE' && adminArticleMatch) {
    if (!authCheck(req)) return sendError(res, 401, 'Yetkisiz');
    const slug = adminArticleMatch[1];
    const file = articleFile(slug);

    // JSON dosyasını sil (varsa)
    if (fs.existsSync(file)) fs.unlinkSync(file);

    // index.json'dan kaldır
    let articles = loadIndex();
    articles = articles.filter(a => a.slug !== slug);
    saveIndex(articles);

    console.log('[DELETE] Makale silindi:', slug);
    return send(res, 200, { ok: true });
  }

  /* ── 404 ── */
  sendError(res, 404, 'Endpoint bulunamadı');
});

server.listen(PORT, () => {
  console.log('Furkan Güven — Makale API');
  console.log('Port    :', PORT);
  console.log('Data    :', DATA_DIR);
  console.log('Token   :', ADMIN_TOKEN.substring(0, 4) + '****');
  console.log('─────────────────────────');
  console.log('Hazır. Nginx proxy: /api/ → http://localhost:' + PORT + '/api/');
});
