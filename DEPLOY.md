# Deployment Guide

This document explains how to deploy the **Beeswax Inquiry Website** in a practical way.

The recommended model is:

- Node app runs privately on an internal port
- reverse proxy handles public access and HTTPS
- SQLite stores inquiry data locally
- admin access is protected with a strong password

---

## 1. Deployment Options

### Option A — Linux VPS + Nginx
Recommended for small production deployment.

### Option B — Windows Server / local Windows host
Suitable if you prefer to run the project on Windows.

### Option C — Internal testing only
Run with `npm start` and access by local IP or localhost.

---

## 2. Prerequisites

Before deployment, make sure you have:

- Node.js installed
- project files uploaded or cloned
- write access to the project directory
- a real `config/config.json`
- a strong admin password
- a domain name if deploying publicly
- HTTPS support on the public entry point

---

## 3. Files You Should Care About

### Code and content
- `server.js`
- `index.html`
- `about.html`
- `products.html`
- `product.html`
- `contact.html`
- `admin.html`
- `content/products.json`

### Runtime configuration
- `config/config.example.json`
- `config/config.json`

### Runtime data
- `data/site.db`

### Assets
- `assets/images/`
- `assets/docs/`

---

## 4. Local Start for Quick Testing

### Install dependencies
```bash
npm install
```

### Create runtime config
```bash
cp config/config.example.json config/config.json
```

On Windows PowerShell:
```powershell
Copy-Item .\config\config.example.json .\config\config.json
```

### Start app
```bash
npm start
```

Default local URL:
- `http://localhost:8080`

---

## 5. Required Config Before Production

Edit `config/config.json`.

### Important fields

#### `site.port`
Internal app port.
Example:
```json
"port": 8080
```

#### `site.baseUrl`
Public domain URL.
Example:
```json
"baseUrl": "https://your-domain.com"
```

#### `site.trustProxy`
Set to `true` when traffic comes through Nginx / IIS / reverse proxy.

#### `admin.username`
Admin login username.

#### `admin.password`
Plain password for local testing only.

#### `admin.passwordSha256`
Recommended for production.
Generate hash with:
```bash
node -e "console.log(require('crypto').createHash('sha256').update('YourStrongPasswordHere','utf8').digest('hex'))"
```

#### `database.path`
SQLite file path.
Default:
```json
"path": "data/site.db"
```

#### `email`
Optional SMTP config if you want inquiry email notifications.

---

## 6. Recommended Production Architecture

### Public side
- domain
- HTTPS certificate
- reverse proxy

### App side
- Node app bound to internal port, such as `8080`
- SQLite database in local `data/`
- admin page accessed through the same domain

### Security recommendations
- do not expose default admin password
- prefer `passwordSha256`
- keep Node behind reverse proxy
- back up SQLite database regularly
- do not commit real secrets to Git

---

## 7. Linux VPS + Nginx Example

### Step 1: upload project
Clone repo or upload files to server.

### Step 2: install dependencies
```bash
npm install
```

### Step 3: create config
```bash
cp config/config.example.json config/config.json
```

### Step 4: edit config
Suggested production values:
- set real domain in `site.baseUrl`
- set `site.trustProxy` to `true`
- set strong admin username/password
- use `passwordSha256`

### Step 5: start app
Quick test:
```bash
npm start
```

Better long-running options:
- PM2
- systemd

### Step 6: reverse proxy through Nginx
Typical idea:
- public HTTPS on port 443
- proxy to `127.0.0.1:8080`

### Step 7: enable HTTPS
Use your preferred SSL method, such as:
- Let's Encrypt
- panel-managed certificate
- gateway-managed certificate

---

## 8. Windows Deployment Notes

If deploying on Windows:

- install Node.js
- run `npm install`
- copy `config.example.json` to `config.json`
- update config values
- run `npm start`
- keep the process alive using a service manager or process tool
- if public, use IIS reverse proxy or another gateway in front of Node

Important:
- make sure the `data/` folder remains writable
- make sure the app restarts after reboot if needed

---

## 9. SMTP / Inquiry Notification Setup

If you want the website to send inquiry notifications by email:

1. set `email.enabled` to `true`
2. fill SMTP host, port, secure mode, username, password
3. set `from`
4. set `to`

After that, submit a test inquiry and confirm email delivery.

---

## 10. Database Notes

This project uses SQLite.

### Good for
- small production sites
- early-stage inquiry websites
- simple internal management

### You should do
- back up `data/site.db`
- avoid committing runtime WAL/SHM files
- ensure disk path is writable

---

## 11. Public Launch Checklist

### Site basics
- [ ] homepage loads
- [ ] about page loads
- [ ] products page loads
- [ ] product detail pages load
- [ ] contact page works
- [ ] admin page works

### Inquiry flow
- [ ] submit test inquiry
- [ ] inquiry appears in admin
- [ ] status update works
- [ ] note update works
- [ ] SMTP works if enabled

### Security
- [ ] default admin password changed
- [ ] `passwordSha256` used in production
- [ ] `site.trustProxy` correct
- [ ] HTTPS enabled
- [ ] real config not committed to Git

### Content
- [ ] company info is correct
- [ ] product content is correct
- [ ] certificates exist if linked
- [ ] images display correctly
- [ ] logo looks correct on desktop and mobile

---

## 12. Git and Runtime File Notes

### Commit to repo
- source code
- static assets
- docs
- `config/config.example.json`

### Do not commit
- real `config/config.json`
- SQLite runtime temp files
- secrets
- production-only local overrides

---

## 13. Suggested Next Improvements

After deployment is stable, the next useful steps are:

- stronger SEO setup
- admin export / filtering improvements
- thank-you page after inquiry submission
- analytics integration
- richer deployment automation
