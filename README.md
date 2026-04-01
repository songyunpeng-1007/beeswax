# Beeswax Lightweight Site + Inquiry Admin

B2B beeswax inquiry website for **Hebei Cera Rica Industrial and Trade Co., Ltd.**

## What is included
- `index.html` - home page
- `about.html` - company introduction page
- `products.html` - 4-product overview page
- `product.html?slug=...` - reusable product detail page
- `contact.html` - live inquiry form page
- `admin.html` - lightweight inquiry dashboard
- `content/products.json` - product data source for 4 core products
- `assets/images/` - organized brand / hero / product / company assets
- `assets/docs/` - certificate PDFs for later frontend use
- `assets/js/contact-form.js` - inquiry form submission + product prefill
- `assets/js/admin.js` - admin list/detail logic
- `assets/js/product-page.js` - product detail rendering from JSON
- `server.js` - Node + Express + SQLite API server
- `config/config.example.json` - runtime config template
- `data/site.db` - local SQLite inquiry storage

## Product detail routes
Current product detail entry points:
- `/product.html?slug=yellow-beeswax`
- `/product.html?slug=white-beeswax`
- `/product.html?slug=yellow-beeswax-pellets-flakes`
- `/product.html?slug=white-beeswax-pellets-flakes`

## Setup
### 1) Install dependencies
```powershell
npm install
```

### 2) Create runtime config
```powershell
Copy-Item .\config\config.example.json .\config\config.json
```

### 3) Edit config/config.json
Key fields:
- `site.port`: local port
- `site.baseUrl`: public base URL after deployment
- `site.trustProxy`: set `true` when the app runs behind Nginx / IIS / reverse proxy and HTTPS is terminated there
- `admin.username`: admin login username
- `admin.password`: plain password fallback for local use
- `admin.passwordSha256`: preferred production field; if filled, server will verify SHA-256 instead of plain password
- `database.path`: SQLite path
- `email.*`: SMTP notification settings

### 4) Generate a SHA-256 admin password hash (recommended)
Replace `YourStrongPasswordHere` with the real password:
```powershell
node -e "console.log(require('crypto').createHash('sha256').update('YourStrongPasswordHere','utf8').digest('hex'))"
```
Then paste the result into `admin.passwordSha256` and clear the plain `admin.password` value.

### 5) Start the site
```powershell
npm start
```

Open:
- Front site: `http://localhost:8080/`
- Contact page: `http://localhost:8080/contact.html`
- Admin login: `http://localhost:8080/api/admin/login`
- Admin dashboard: `http://localhost:8080/admin.html`
- Health check: `http://localhost:8080/api/health`
- Product list API: `http://localhost:8080/api/products`

## Current backend capabilities
- inquiry form submission to `/api/inquiries`
- SQLite storage in `data/site.db`
- honeypot field support
- submission rate limiting
- admin login with cookie session
- login attempt rate limiting
- inquiry list, detail, status update, internal note update
- product JSON API (`/api/products`, `/api/products/:slug`)

## Asset organization
Main organized folders:
- `assets/images/brand/`
- `assets/images/hero/`
- `assets/images/products/`
- `assets/images/company/`
- `assets/docs/`

Source material remains in `D:\公司文件`; this project now contains renamed web-ready copies for the current launch version.

## Deployment notes
- do not commit real `config/config.json` with production secrets
- change the default admin password before exposing admin login
- prefer `admin.passwordSha256` over plain password in production
- enable HTTPS at the reverse proxy
- if reverse-proxied, set `site.trustProxy=true`
- keep the Node app private and proxy traffic to it
- back up `data/site.db` regularly

## Pre-launch verification checklist
### Frontend
- [ ] home / about / products / product / contact all open correctly
- [ ] each of the 4 product cards opens the correct detail page
- [ ] contact form preselect works when entering from product pages
- [ ] mobile navigation works on small screens
- [ ] all main images load from organized directories

### Inquiry flow
- [ ] submit a test inquiry from `contact.html`
- [ ] confirm the record appears in `/admin.html`
- [ ] update inquiry status and internal note successfully
- [ ] if SMTP is enabled, confirm email notification is received

### Config and security
- [ ] `config/config.json` exists and matches deployment environment
- [ ] admin password is changed from default
- [ ] production uses `passwordSha256`
- [ ] `site.baseUrl` is updated to the public domain
- [ ] `site.trustProxy` is correct for the deployment topology
- [ ] HTTPS is enabled at the public entry point

### Content and assets
- [ ] company email / phone / address are correct
- [ ] WhatsApp remains hidden in V1
- [ ] certificate PDFs are present in `assets/docs/`
- [ ] product descriptions match current commercial positioning
- [ ] white pellets/flakes image fallback is acceptable for V1

## Known V1 limitations
- no separate confirmed white pellets/flakes image yet; current detail page uses available white beeswax image
- no product CMS yet; product content is managed in `content/products.json`
- certificate PDFs are organized but not yet rendered as polished frontend certificate cards
