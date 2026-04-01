const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const LEGACY_DATA_FILE = path.join(DATA_DIR, 'inquiries.json');
const CONFIG_DIR = path.join(ROOT, 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONFIG_EXAMPLE_FILE = path.join(CONFIG_DIR, 'config.example.json');
const PRODUCTS_FILE = path.join(ROOT, 'content', 'products.json');
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_MAX = 8;
const submissionTracker = new Map();
const loginTracker = new Map();
const sessions = new Map();

function ensureFile(filePath, fallbackContent) {
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fallbackContent, 'utf8');
  }
}

if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(CONFIG_EXAMPLE_FILE)) {
  fs.copyFileSync(CONFIG_EXAMPLE_FILE, CONFIG_FILE);
}
ensureFile(
  CONFIG_FILE,
  JSON.stringify(
    {
      site: { port: 8080, baseUrl: 'http://localhost:8080', trustProxy: false },
      admin: { username: 'admin', password: 'change-this-password', passwordSha256: '' },
      database: { path: 'data/site.db' },
      email: { enabled: false, to: [] }
    },
    null,
    2
  )
);

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function loadProducts() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveDatabasePath(config) {
  const configuredPath = String((config.database && config.database.path) || 'data/site.db');
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.join(ROOT, configuredPath);
}

function openDatabase(config) {
  const databasePath = resolveDatabasePath(config);
  const databaseDir = path.dirname(databasePath);
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }
  return new sqlite3.Database(databasePath);
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initializeDatabase(db) {
  await runAsync(db, 'PRAGMA journal_mode = WAL;');
  await runAsync(
    db,
    `CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      contact_method TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      note TEXT NOT NULL DEFAULT '',
      sourcePage TEXT NOT NULL DEFAULT 'contact.html',
      ip TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );`
  );
  await runAsync(db, 'CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(createdAt);');
}

async function migrateLegacyInquiriesIfNeeded(db) {
  const countResult = await getAsync(db, 'SELECT COUNT(*) AS value FROM inquiries;');
  if ((countResult && countResult.value > 0) || !fs.existsSync(LEGACY_DATA_FILE)) {
    return 0;
  }

  let legacyItems = [];
  try {
    legacyItems = JSON.parse(fs.readFileSync(LEGACY_DATA_FILE, 'utf8'));
    if (!Array.isArray(legacyItems)) {
      legacyItems = [];
    }
  } catch {
    legacyItems = [];
  }

  if (!legacyItems.length) {
    return 0;
  }

  await runAsync(db, 'BEGIN TRANSACTION;');
  try {
    const sql = `
      INSERT OR IGNORE INTO inquiries (
        id, name, company, email, contact_method, country, product,
        quantity, message, status, note, sourcePage, ip, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    for (const item of legacyItems) {
      const createdAt = String(item.createdAt || new Date().toISOString());
      await runAsync(db, sql, [
        String(item.id || crypto.randomUUID()),
        String(item.name || ''),
        String(item.company || ''),
        String(item.email || ''),
        String(item.contact_method || ''),
        String(item.country || ''),
        String(item.product || ''),
        String(item.quantity || ''),
        String(item.message || ''),
        String(item.status || 'new'),
        String(item.note || ''),
        String(item.sourcePage || 'contact.html'),
        String(item.ip || ''),
        createdAt,
        String(item.updatedAt || createdAt)
      ]);
    }

    await runAsync(db, 'COMMIT;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    throw error;
  }

  return legacyItems.length;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function hashSha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function createSession(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  const secureFlag = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; SameSite=Lax${secureFlag}`);
}

function clearSession(req, res) {
  const token = parseCookies(req.headers.cookie).admin_session;
  if (token) sessions.delete(token);
  const secureFlag = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`);
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie).admin_session;
}

function requireAdmin(req, res, next) {
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function clampText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function markAttempt(tracker, key, windowMs, maxCount) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const history = (tracker.get(key) || []).filter((timestamp) => timestamp > windowStart);
  if (history.length >= maxCount) {
    tracker.set(key, history);
    return true;
  }
  history.push(now);
  tracker.set(key, history);
  return false;
}

function isRateLimited(ip) {
  return markAttempt(submissionTracker, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
}

function isLoginRateLimited(ip) {
  return markAttempt(loginTracker, ip, LOGIN_LIMIT_WINDOW_MS, LOGIN_LIMIT_MAX);
}

function verifyAdminCredentials(config, username, password) {
  const admin = config.admin || {};
  if (String(username || '') !== String(admin.username || '')) {
    return false;
  }

  if (admin.passwordSha256) {
    return hashSha256(password) === String(admin.passwordSha256);
  }

  return String(password || '') === String(admin.password || '');
}

async function sendInquiryEmail(inquiry, config) {
  if (!config.email || !config.email.enabled) {
    return { skipped: true };
  }

  const recipients = Array.isArray(config.email.to) ? config.email.to.filter(Boolean) : [];
  if (!recipients.length) {
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: Boolean(config.email.secure),
    auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined
  });

  const subject = `[New Inquiry] ${inquiry.product} | ${inquiry.name} | ${inquiry.country || 'Unknown Country'}`;
  const lines = [
    `Time: ${inquiry.createdAt}`,
    `Name: ${inquiry.name}`,
    `Company: ${inquiry.company || '-'}`,
    `Email: ${inquiry.email}`,
    `Preferred Contact: ${inquiry.contact_method || '-'}`,
    `Country: ${inquiry.country || '-'}`,
    `Product: ${inquiry.product || '-'}`,
    `Quantity: ${inquiry.quantity || '-'}`,
    `Message: ${inquiry.message || '-'}`,
    `Source Page: ${inquiry.sourcePage || 'contact.html'}`,
    `IP: ${inquiry.ip || '-'}`
  ];

  await transporter.sendMail({
    from: config.email.from,
    to: recipients.join(', '),
    replyTo: inquiry.email,
    subject,
    text: lines.join('\n'),
    html: `<h2>New Website Inquiry</h2><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
  });

  return { skipped: false };
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT));

let db;

app.get('/api/health', (req, res) => {
  const config = loadConfig();
  res.json({
    ok: true,
    emailEnabled: Boolean(config.email && config.email.enabled),
    hasAdminPasswordSha256: Boolean(config.admin && config.admin.passwordSha256),
    productCount: loadProducts().length
  });
});

app.get('/api/products', (req, res) => {
  const items = loadProducts().map((item) => ({
    slug: item.slug,
    name: item.name,
    shortDescription: item.shortDescription,
    coverImage: item.coverImage,
    applications: item.applications || []
  }));
  res.json({ items });
});

app.get('/api/products/:slug', (req, res) => {
  const product = loadProducts().find((item) => item.slug === req.params.slug);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  return res.json({ item: product });
});

app.post('/api/inquiries', async (req, res) => {
  const payload = req.body || {};
  const clientIp = getClientIp(req);

  if (String(payload.website || '').trim()) {
    return res.status(400).json({ error: 'Submission failed.' });
  }

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const requiredFields = ['name', 'email', 'product', 'message'];
  for (const field of requiredFields) {
    if (!String(payload[field] || '').trim()) {
      return res.status(400).json({ error: `Field '${field}' is required.` });
    }
  }

  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const inquiry = {
    id: crypto.randomUUID(),
    name: clampText(payload.name, 100),
    company: clampText(payload.company, 150),
    email: clampText(payload.email, 150),
    contact_method: clampText(payload.contact_method, 120),
    country: clampText(payload.country, 100),
    product: clampText(payload.product, 150),
    quantity: clampText(payload.quantity, 100),
    message: clampText(payload.message, 3000),
    status: 'new',
    note: '',
    sourcePage: String(req.headers.referer || '').split('/').pop() || 'contact.html',
    ip: clientIp,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await runAsync(
      db,
      `INSERT INTO inquiries (
        id, name, company, email, contact_method, country, product,
        quantity, message, status, note, sourcePage, ip, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        inquiry.id,
        inquiry.name,
        inquiry.company,
        inquiry.email,
        inquiry.contact_method,
        inquiry.country,
        inquiry.product,
        inquiry.quantity,
        inquiry.message,
        inquiry.status,
        inquiry.note,
        inquiry.sourcePage,
        inquiry.ip,
        inquiry.createdAt,
        inquiry.updatedAt
      ]
    );
  } catch {
    return res.status(500).json({ error: 'Failed to save inquiry.' });
  }

  const config = loadConfig();
  let emailResult = { skipped: true };
  try {
    emailResult = await sendInquiryEmail(inquiry, config);
  } catch (error) {
    console.error('Email send failed:', error.message);
  }

  res.status(201).json({ ok: true, id: inquiry.id, emailSent: !emailResult.skipped });
});

app.get('/api/admin/login', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body class="admin-page">
  <main class="section">
    <div class="container admin-login-wrap">
      <form class="card admin-login-card" method="post" action="/api/admin/login">
        <p class="eyebrow">Inquiry Admin</p>
        <h1>Login</h1>
        <p class="muted">Use the admin username and password from config/config.json.</p>
        <label>Username<input type="text" name="username" autocomplete="username" required></label>
        <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Sign In</button>
      </form>
    </div>
  </main>
</body>
</html>`);
});

app.post('/api/admin/login', (req, res) => {
  const config = loadConfig();
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  const clientIp = getClientIp(req);

  if (isLoginRateLimited(clientIp)) {
    return res.status(429).type('html').send('<p>Too many login attempts. Please try again later.</p>');
  }

  if (verifyAdminCredentials(config, username, password)) {
    createSession(req, res);
    return res.redirect('/admin.html');
  }

  return res.status(401).type('html').send('<p>Login failed. <a href="/api/admin/login">Try again</a>.</p>');
});

app.get('/api/admin/me', (req, res) => {
  const token = getSessionToken(req);
  const isAuthenticated = Boolean(token && sessions.has(token));
  if (!isAuthenticated) {
    return res.status(401).json({ authenticated: false });
  }

  const config = loadConfig();
  return res.json({ authenticated: true, username: config.admin && config.admin.username ? config.admin.username : 'admin' });
});

app.post('/api/admin/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.get('/api/admin/inquiries', requireAdmin, async (req, res) => {
  try {
    const items = await allAsync(
      db,
      `SELECT id, name, company, email, contact_method, country, product, quantity,
              message, status, note, sourcePage, ip, createdAt, updatedAt
       FROM inquiries
       ORDER BY datetime(createdAt) DESC, rowid DESC;`
    );
    res.json({ items });
  } catch {
    res.status(500).json({ error: 'Failed to load inquiries.' });
  }
});

app.patch('/api/admin/inquiries/:id', requireAdmin, async (req, res) => {
  const allowedStatuses = new Set(['new', 'contacted', 'follow_up', 'closed', 'invalid']);

  let item;
  try {
    item = await getAsync(
      db,
      `SELECT id, name, company, email, contact_method, country, product, quantity,
              message, status, note, sourcePage, ip, createdAt, updatedAt
       FROM inquiries
       WHERE id = ?;`,
      [req.params.id]
    );
  } catch {
    return res.status(500).json({ error: 'Failed to load inquiry.' });
  }

  if (!item) {
    return res.status(404).json({ error: 'Inquiry not found.' });
  }

  let status = item.status;
  if (req.body.status && allowedStatuses.has(req.body.status)) {
    status = req.body.status;
  }
  let note = item.note || '';
  if (typeof req.body.note === 'string') {
    note = clampText(req.body.note, 2000);
  }

  try {
    await runAsync(db, 'UPDATE inquiries SET status = ?, note = ?, updatedAt = ? WHERE id = ?;', [
      status,
      note,
      new Date().toISOString(),
      req.params.id
    ]);

    const updated = await getAsync(
      db,
      `SELECT id, name, company, email, contact_method, country, product, quantity,
              message, status, note, sourcePage, ip, createdAt, updatedAt
       FROM inquiries
       WHERE id = ?;`,
      [req.params.id]
    );
    res.json({ ok: true, item: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update inquiry.' });
  }
});

async function startServer() {
  const config = loadConfig();
  app.set('trust proxy', Boolean(config.site && config.site.trustProxy));
  db = openDatabase(config);

  await initializeDatabase(db);
  const migratedCount = await migrateLegacyInquiriesIfNeeded(db);
  if (migratedCount > 0) {
    console.log(`Migrated ${migratedCount} inquiries from ${path.relative(ROOT, LEGACY_DATA_FILE)} to SQLite.`);
  }

  const port = Number(process.env.PORT || config.site.port || 8080);
  app.listen(port, () => {
    console.log(`Beeswax site running at http://localhost:${port}`);
    console.log(`Admin login page: http://localhost:${port}/api/admin/login`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
