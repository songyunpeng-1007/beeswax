# Beeswax Inquiry Website

B2B beeswax inquiry website for **Hebei Cera Rica Industrial and Trade Co., Ltd.**

This project is a lightweight inquiry-focused independent site for overseas buyers. It is designed for a simple early-stage workflow:

- show company and product information
- guide buyers to submit inquiries
- store inquiries locally
- let the team review and update inquiries from a small admin page

It is intentionally simple and practical rather than CMS-heavy.

---

## 1. Features

### Frontend
- Homepage with supplier-style positioning
- About page with company profile, company photos, and certificate references
- Products page for 4 core beeswax product directions
- Reusable product detail page driven by JSON data
- Contact page with live inquiry form
- Click-to-enlarge image preview

### Inquiry workflow
- Inquiry form submission to backend API
- Product prefill from product detail pages
- Anti-spam honeypot field
- Basic submission rate limiting
- SQLite-based inquiry storage

### Admin
- Lightweight admin login
- Inquiry list and detail view
- Status update
- Internal note update

### Content structure
- Product data managed in `content/products.json`
- Certificates stored in `assets/docs/`
- Brand / company / product / hero images organized under `assets/images/`

---

## 2. Tech Stack

- **Node.js**
- **Express**
- **SQLite**
- **Vanilla HTML / CSS / JS**
- **Nodemailer** (optional SMTP notification support)

---

## 3. Project Structure

```text
beeswax-site-prototype/
├─ about.html
├─ admin.html
├─ contact.html
├─ index.html
├─ product.html
├─ products.html
├─ server.js
├─ package.json
├─ config/
│  ├─ config.example.json
│  └─ config.json           # local runtime config, do not commit real secrets
├─ content/
│  ├─ products.json
│  └─ website-content-enrichment-draft.md
├─ data/
│  ├─ inquiries.json        # legacy data file
│  └─ site.db               # SQLite database (runtime)
├─ assets/
│  ├─ css/
│  ├─ docs/
│  ├─ images/
│  └─ js/
└─ README.md
```

---

## 4. Main Pages

- `index.html` — homepage
- `about.html` — company introduction
- `products.html` — product overview page
- `product.html?slug=...` — reusable product detail page
- `contact.html` — inquiry submission page
- `admin.html` — lightweight admin dashboard

### Product detail routes
- `/product.html?slug=yellow-beeswax`
- `/product.html?slug=white-beeswax`
- `/product.html?slug=yellow-beeswax-pellets-flakes`
- `/product.html?slug=white-beeswax-pellets-flakes`

---

## 5. Local Development Setup

### Step 1: Install dependencies
```powershell
npm install
```

### Step 2: Create local config
```powershell
Copy-Item .\config\config.example.json .\config\config.json
```

### Step 3: Edit `config/config.json`
Important fields:

- `site.port` — local port
- `site.baseUrl` — public base URL after deployment
- `site.trustProxy` — set `true` when deployed behind Nginx / IIS / reverse proxy
- `admin.username` — admin username
- `admin.password` — plain fallback password for local use
- `admin.passwordSha256` — recommended production password field
- `database.path` — SQLite database path
- `email.*` — SMTP notification settings

### Step 4: Optional — generate SHA-256 password hash
```powershell
node -e "console.log(require('crypto').createHash('sha256').update('YourStrongPasswordHere','utf8').digest('hex'))"
```

Paste the result into `admin.passwordSha256`, then clear the plain `admin.password` value.

### Step 5: Start the app
```powershell
npm start
```

Default local URLs:
- Front site: `http://localhost:8080/`
- Contact page: `http://localhost:8080/contact.html`
- Admin page: `http://localhost:8080/admin.html`
- Health check: `http://localhost:8080/api/health`
- Product API: `http://localhost:8080/api/products`

---

## 6. Backend Capabilities

Current backend supports:

- `POST /api/inquiries` — create inquiry
- `GET /api/products` — product list
- `GET /api/products/:slug` — product detail JSON
- admin login with cookie session
- inquiry list and detail query
- inquiry status update
- internal note update
- SQLite persistence

---

## 7. Deployment Guide

This project is best deployed as a **small Node app behind a reverse proxy**.

### Recommended production shape
- Public domain handled by **Nginx / IIS / Caddy / another reverse proxy**
- Node app listens on an internal port such as `8080`
- HTTPS terminated at the reverse proxy
- Node app kept private behind the proxy

### Production config checklist
In `config/config.json`:

- set `site.baseUrl` to your real public domain
- set `site.trustProxy` to `true` if traffic comes through reverse proxy
- change admin username/password
- prefer `admin.passwordSha256` over plain password
- configure SMTP only if you want email notifications

### Important security notes
- do **not** commit real `config/config.json` with secrets
- do **not** expose default admin password
- keep the admin behind strong credentials
- prefer reverse proxy + HTTPS instead of exposing raw Node directly
- back up `data/site.db` regularly

---

## 8. Example Deployment Steps (Linux VPS + Nginx)

### 1) Upload project
Clone or upload the project to your server.

### 2) Install Node dependencies
```bash
npm install
```

### 3) Create config
```bash
cp config/config.example.json config/config.json
```

### 4) Edit config
Set:
- correct `site.baseUrl`
- strong admin password
- `site.trustProxy: true`

### 5) Start the app
For quick testing:
```bash
npm start
```

For long-running production usage, use a process manager such as:
- PM2
- systemd
- Docker (if you later want to containerize)

### 6) Reverse proxy to Node
Example idea:
- public domain → Nginx 443
- Nginx forwards to `127.0.0.1:8080`

### 7) Enable HTTPS
Use your normal SSL flow, such as:
- Let's Encrypt
- your existing gateway / panel setup

---

## 9. Windows Deployment Notes

If deployed on Windows:

- keep Node app running with a stable process tool
- update `config/config.json`
- use IIS reverse proxy or another front-end proxy if needed
- keep `site.trustProxy` aligned with your setup
- make sure `data/` remains writable

---

## 10. Asset Notes

Main asset folders:
- `assets/images/brand/`
- `assets/images/hero/`
- `assets/images/products/`
- `assets/images/company/`
- `assets/docs/`

Source material originally came from local company files, then was copied into web-ready directories for this project version.

---

## 11. Pre-Launch Checklist

### Frontend
- [ ] homepage opens correctly
- [ ] about page opens correctly
- [ ] products page opens correctly
- [ ] all 4 product detail pages open correctly
- [ ] contact form prefill works from product pages
- [ ] image enlarge works on important images
- [ ] mobile menu works

### Inquiry flow
- [ ] submit a test inquiry from `contact.html`
- [ ] confirm it appears in `admin.html`
- [ ] update inquiry status successfully
- [ ] update internal note successfully
- [ ] test email notification if SMTP is enabled

### Deployment / security
- [ ] `config/config.json` matches deployment environment
- [ ] admin password is changed
- [ ] `passwordSha256` is used in production
- [ ] `site.baseUrl` is updated
- [ ] `site.trustProxy` is correct
- [ ] HTTPS is enabled publicly

### Content
- [ ] company email / phone / address are correct
- [ ] product content matches actual commercial positioning
- [ ] certificate PDFs are present if referenced on page
- [ ] logo and images display correctly

---

## 12. Known V1 Limitations

- No CMS yet; product content is maintained in `content/products.json`
- Inquiry admin is intentionally lightweight, not a full CRM
- White pellets / flakes visual still uses available image fallback direction
- SMTP exists but needs real production configuration if enabled
- SQLite is fine for V1, but larger operations may later prefer a more robust backend stack

---

## 13. Recommended Next Improvements

- Improve SEO titles / descriptions / schema markup
- Add thank-you page or stronger inquiry success flow
- Add CSV export in admin
- Add richer inquiry filtering in admin
- Add blog / FAQ content for SEO growth
- Add better production deployment docs once target hosting is finalized

---

## 14. Git Notes

Recommended tracked files:
- source code
- images used by the site
- docs / certificates intended for frontend use
- `config/config.example.json`

Recommended untracked files:
- real `config/config.json`
- runtime SQLite WAL/SHM files
- secrets
- environment-specific overrides

---

## 15. License / Internal Usage

This repository is currently organized as a practical project repository for internal business website deployment and iteration.
