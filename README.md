# IMAP Connector

**Zero-click bulk email routing setup for Cloudflare.** Paste credentials → tool handles everything: enable routing, create DNS, add destination, **auto-verify via IMAP**, set catch-all rule. Standalone — no agent needed.

## What It Does

```
Domain (Active in Cloudflare)
    ↓
Tool enables email routing + creates MX/TXT/SPF DNS records
    ↓
Tool adds destination address via Cloudflare API
    ↓
Tool connects to your IMAP inbox → finds Cloudflare verification email
    ↓
Tool clicks verification link automatically (zero manual clicks)
    ↓
Tool sets catch-all rule → all emails to *@yourdomain.com → your inbox
    ↓
Done: any-email@yourdomain.com lands in your inbox
```

## Features

- ✅ Bulk setup unlimited domains in one run
- ✅ Auto-enable Cloudflare email routing
- ✅ Auto-create DNS records (MX, TXT, SPF)
- ✅ Auto-add destination address via API
- ✅ **IMAP auto-verify** — finds + clicks Cloudflare verification link (no manual inbox checking)
- ✅ Set catch-all rule → forward all emails to one inbox
- ✅ Supports Gmail, Outlook, Yahoo, ProtonBridge, custom IMAP
- ✅ Web UI — no CLI commands needed after setup
- ✅ Streaming progress (see each step in real-time)
- ✅ Input validation + proper error handling
- ✅ Standalone — runs as a server, no agent dependency

## Quick Start

### Prerequisites

| Requirement | Why |
|---|---|
| **Node.js v18+** | JavaScript runtime |
| **A domain** | Added to Cloudflare, nameservers pointing to CF, status "Active" |
| **Cloudflare account** | Global API Key + account email |
| **Email inbox** | Gmail/Outlook/Yahoo/etc with IMAP access (for auto-verify) |

### Install & Run

```bash
# 1. Extract
unzip imap-connector-v4.zip
cd imap-connector

# 2. Install dependency (imapflow for IMAP auto-verify)
npm install imapflow

# 3. Run
node server.js
```

Server starts on `http://localhost:4444`. Open in browser.

### Use the Tool

1. Open `http://localhost:4444` (or `http://YOUR_IP:4444` if on VPS)
2. Fill the form:
   - **Cloudflare API Key** — `dash.cloudflare.com → Profile → API Tokens → Global API Key → View`
   - **Account Email** — your Cloudflare login email
   - **Domains** — one per line (must be Active in CF)
   - **Destination Email** — the inbox where all emails will forward to
   - **IMAP Provider** — Gmail / Outlook / Yahoo / ProtonBridge / Custom
   - **IMAP Password** — App Password (Gmail/Yahoo) or regular password (Outlook)
3. Click **🚀 Full Auto Setup**
4. Watch progress — tool does everything
5. Done — test by sending email to `test@yourdomain.com`

## Gmail App Password

Google hides the App Password page behind passkeys now. Direct URL:

```
https://myaccount.google.com/apppasswords
```

**Prerequisite:** 2-Step Verification must be ON first.

Steps:
1. Enable 2FA: `https://myaccount.google.com/signinoptions/twosv`
2. Open: `https://myaccount.google.com/apppasswords`
3. App name: `imap-connector` → Create
4. Copy 16-char code (`abcd-efgh-ijkl-mnop`)
5. Paste to tool's IMAP Password field

If Google redirects to passkey screen: remove passkey temporarily (Security → How you sign in → Passkeys → Remove), create App Password, then re-enable passkey.

See in-app guide at `http://localhost:4444/app-password` for full walkthrough.

## Setup Guide (Adding Domain to Cloudflare)

If your domain isn't in Cloudflare yet:

1. Sign up: `https://dash.cloudflare.com/sign-up`
2. Add Site → enter domain → choose **Free** plan
3. Cloudflare gives 2 nameservers
4. Go to your domain registrar (Namecheap/GoDaddy/Hostinger/etc)
5. Change nameservers to Cloudflare's
6. Wait 5-60 min for propagation (check: `https://www.whatsmydns.net`)
7. When status shows "Active" → ready to use tool

See in-app guide at `http://localhost:4444/guide` for screenshots + details.

## Running on Different Environments

### Windows (WSL)

```powershell
# Open WSL (Ubuntu)
wsl

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Extract + run
unzip imap-connector-v4.zip
cd imap-connector
npm install imapflow
node server.js
```

Open `http://localhost:4444` in Windows browser.

### Linux (VPS / Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Extract + run
unzip imap-connector-v4.zip
cd imap-connector
npm install imapflow
node server.js
```

For persistent deployment (survives reboot):
```bash
npm install -g pm2
pm2 start server.js --name imap-connector
pm2 save
pm2 startup  # follow instructions
```

### macOS

```bash
# Install Node.js
brew install node

# Extract + run
unzip imap-connector-v4.zip
cd imap-connector
npm install imapflow
node server.js
```

### Docker (optional)

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json .
RUN npm install imapflow
COPY . .
EXPOSE 4444
CMD ["node", "server.js"]
```

```bash
docker build -t imap-connector .
docker run -p 4444:4444 imap-connector
```

## Port Already in Use?

If port 4444 is taken, change it:

```bash
# Option 1: environment variable
PORT=5555 node server.js

# Option 2: edit server.js (line 14)
# const PORT = process.env.PORT || 4444;
# change 4444 to whatever port you want
```

Check what's using a port:
```bash
# Linux/Mac
lsof -i :4444

# Windows (cmd)
netstat -ano | findstr :4444
```

Kill process on that port:
```bash
# Linux/Mac
kill -9 $(lsof -t -i :4444)

# Windows
taskkill /PID <PID> /F
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Setup UI (homepage) |
| `GET` | `/health` | Health check JSON |
| `GET` | `/guide` | Full setup guide (add domain to CF) |
| `GET` | `/app-password` | Gmail App Password guide |
| `GET` | `/tutorial` | Tutorial (markdown) |
| `GET` | `/guide-part1.html` | Guide Part 1 |
| `GET` | `/guide-part2.html` | Guide Part 2 |
| `GET` | `/guide-part3.html` | Guide Part 3 |
| `POST` | `/api/test` | Test CF + IMAP credentials |
| `POST` | `/api/setup` | Full auto setup (streaming) |

## IMAP Provider Config

| Provider | Host | Port | TLS | Notes |
|---|---|---|---|---|
| Gmail | `imap.gmail.com` | 993 | Yes | Needs App Password |
| Outlook | `outlook.office365.com` | 993 | Yes | Regular password |
| Yahoo | `imap.mail.yahoo.com` | 993 | Yes | Needs App Password |
| ProtonMail | `127.0.0.1` | 1143 | No | Requires Proton Bridge |
| Custom | any | 993/143 | varies | Manual host + port |

## How Auto-Verify Works

Cloudflare requires email verification when you add a destination address. They send an email with a verification link. Normally you'd check inbox + click manually.

This tool automates that:

1. Tool adds destination via Cloudflare API
2. Cloudflare sends verification email to that address
3. Tool connects to your IMAP inbox
4. Tool polls inbox (up to 2 minutes) searching for Cloudflare email
5. Tool extracts verification link from email source
6. Tool visits the link (follows redirects) → destination becomes "Verified"
7. Tool proceeds to set catch-all rule

**IMAP credentials are only used for this one-time verification.** After that, Cloudflare handles all forwarding. You can revoke the App Password after setup.

## Troubleshooting

### "Domain not found in Cloudflare"
- Domain isn't added to CF, or nameservers haven't propagated
- Check: `https://www.whatsmydns.net` (NS records)
- Wait for status "Active" in CF dashboard

### "CF credential check failed"
- Wrong API key or email
- API key: `dash.cloudflare.com → Profile → API Tokens → Global API Key`
- Must be Global API Key (not API Token)

### IMAP connection failed
- Gmail: needs App Password, not regular password
- Check 2FA is ON before creating App Password
- Yahoo: same, needs App Password
- Outlook: regular password works

### "Verification email not found"
- Cloudflare email might be in spam folder
- Destination email must match IMAP inbox
- Tool polls for 2 minutes — if email delayed, re-run after it arrives

### Email forwarding not working after setup
- DNS propagation takes 5-30 min after MX records created
- Check catch-all rule is enabled in CF dashboard
- Verify destination email status is "Verified" in CF

### Port 4444 already in use
- See "Port Already in Use?" section above
- Or: `PORT=5555 node server.js`

## Security Notes

- IMAP credentials are used in-memory only, not stored
- After setup, App Password can be revoked
- Cloudflare API key is used for the session, not persisted
- Tool doesn't store any credentials to disk
- All communication over HTTPS to Cloudflare API
- IMAP connection uses TLS (port 993)

## Tech Stack

- **Node.js** — runtime
- **http** — built-in HTTP server (no Express needed)
- **https** — Cloudflare API + verification link visit
- **imapflow** — IMAP client for auto-verify

No database. No external services. No telemetry. Pure local tool.

## License

MIT — do whatever.

---

**Issues?** Check troubleshooting above. Tool runs standalone — no agent needed after deploy.
