# IMAP Connector

**Tool buat setup email routing Cloudflare secara bulk + otomatis.** 
Lu tinggal paste API key + IMAP creds + list domain → tool kerjain semua: enable routing, bikin DNS, verifikasi email otomatis via IMAP, set catch-all rule. Ga perlu klik link verifikasi manual.

---

## Apa yang Tool Ini Lakukan?

```
Lu punya domain (udah Active di Cloudflare)
        ↓
Tool: enable email routing + bikin DNS records (MX/TXT/SPF)
        ↓
Tool: tambah destination email via Cloudflare API
        ↓
Tool: connect ke IMAP inbox lu → cari email verifikasi dari Cloudflare
        ↓
Tool: klik link verifikasi OTOMATIS (ga perlu buka inbox manual)
        ↓
Tool: set catch-all rule → semua email ke *@domain.com → 1 inbox lu
        ↓
SELESAI: apa-apa@domain.com, admin@domain.com, dll → masuk ke inbox lu
```

Jadi setelah setup: lu bisa bikin alamat email apa aja dengan domain lu (`user1@domain.com`, `user2@domain.com`, dst) dan semuanya masuk ke 1 inbox Gmail/Outlook lu.

---

## Apa Saja yang Butuh Dipersiapkan?

| Yang Dibutuhin | Kenapa | Cara Dapet |
|---|---|---|
| **Domain** | Domain yang mau dipake buat email | Beli di Namecheap/GoDaddy/Hostinger |
| **Cloudflare account** | Buat manage DNS + email routing | Daftar gratis: https://dash.cloudflare.com/sign-up |
| **Domain Active di Cloudflare** | Domain harus udah pointing ke CF | Add domain ke CF → ganti nameserver di registrar → tunggu Active |
| **Cloudflare API Key** | Buat tool bisa kontrol CF account lu | CF dashboard → Profile → API Tokens → Global API Key → View |
| **Email inbox** | Buat nerima semua email yang masuk | Gmail / Outlook / Yahoo / dll |
| **IMAP access** | Buat tool bisa auto-verify email | Gmail: App Password. Outlook: password biasa |
| **Node.js** | Runtime buat jalanin tool | Install v18+ (liat bawah) |

---

## Cara Setup Domain di Cloudflare (Manual, 1x per domain)

> **Ini ga bisa di-otomatisasi.** Ganti nameserver harus manual di registrar tempat lu beli domain.

### Step 1: Login Cloudflare
- Buka https://dash.cloudflare.com
- Login atau daftar (gratis)

### Step 2: Add Domain
- Klik tombol **"Add a Site"** (kanan atas, tombol biru)
- Masukkan domain lu (contoh: `mydomain.com`)
- Klik **"Add site"**
- Pilih plan **"Free"** (gratis) → Continue

### Step 3: Copy Nameserver dari Cloudflare
Cloudflare bakal kasih 2 nameserver, contoh:
```
elijah.ns.cloudflare.com
pola.ns.cloudflare.com
```
**Copy kedua nameserver ini.**

### Step 4: Ganti Nameserver di Registrar
Login ke tempat lu beli domain:

**Namecheap:**
1. Domain List → Manage (domain lu)
2. Nameservers → **Custom DNS**
3. Paste 2 nameserver Cloudflare
4. Save (centang)

**GoDaddy:**
1. My Products → Domains → DNS
2. Nameservers → Change → **Custom**
3. Paste 2 nameserver Cloudflare
4. Save

**Hostinger:**
1. Domains → Manage → Nameservers
2. Change Nameservers → **Custom**
3. Paste 2 nameserver Cloudflare
4. Save

### Step 5: Tunggu Propagasi
- Balik ke Cloudflare → klik **"Done, check nameservers"**
- Tunggu 5-60 menit (biasanya 10-15 menit)
- Status domain berubah jadi **"Active"** (badge hijau)
- Cek global propagation: https://www.whatsmydns.net (type: NS)

> **Setelah status Active → domain siap dipake sama tool.**  
> Buka tool → isi form → klik setup → done.

---

## Cara Dapet Gmail App Password

> **Google sekarang nyuruh pake Passkey.** Jangan ikutin. App Password masih ada, tapi URL-nya disembunyiin.

### Step 1: Aktifin 2-Step Verification (2FA)
Kalau belum on:
- Buka https://myaccount.google.com/signinoptions/twosv
- Klik **"Turn on"** → ikutin setup (OTP via SMS/Authenticator app)

### Step 2: Buka Halaman App Password (LANGSUNG)
**Jangan cari dari menu Google** (bakal dilarikan ke Passkey). Buka URL ini langsung:

```
https://myaccount.google.com/apppasswords
```

### Step 3: Bikin App Password Baru
- Di input **"App name"** → isi apa aja, contoh: `imap-connector`
- Klik **"Create"**
- Google generate password 16 karakter

### Step 4: Copy Password
Muncul popup kuning yang nampilin:
```
abcd-efgh-ijkl-mnop
```
**Copy password ini** (format 4-4-4-4 dengan dash).

> Kalau Google redirect ke halaman Passkey:  
> Hapus passkey dulu (Security → How you sign in → Passkeys → Remove)  
> Balik ke URL App Password → bikin password → enable passkey lagi.

---

## Cara Download & Install Tool

### Opsi A: Download ZIP (Paling Gampang)

1. Buka https://github.com/sirenwontdie/IMAP-CONNECTOR
2. Klik tombol hijau **"Code"** → **"Download ZIP"**
3. Extract ZIP ke folder mana aja

### Opsi B: Git Clone

> **Apa itu git clone?**  
> Git clone = copy repository dari GitHub ke komputer lu.  
> **Aman ga?** YA AMAN. Lu cuma download code yang udah public. Ga ada yang di-install ke system, ga ada malware, ga ada akses ke apa-apa. Code-nya bisa lu baca sendiri di `server.js` — semua open source.

**Cara:**
```bash
git clone https://github.com/sirenwontdie/IMAP-CONNECTOR.git
cd IMAP-CONNECTOR
```

Kalau belum punya git:
- **Windows:** Download https://git-scm.com/download/win → install → buka Git Bash
- **Mac:** `brew install git` atau download https://git-scm.com/download/mac
- **Linux:** `sudo apt install git` (Ubuntu/Debian)

---

## Cara Jalanin Tool

### Prerequisites: Install Node.js

Tool ini butuh **Node.js v18 atau lebih baru**.

**Cek apakah Node.js udah install:**
```bash
node --version
```
Kalau muncul `v18.x.x` atau lebih tinggi → udah ready.  
Kalau belum, install dulu:

**Windows:**
1. Download https://nodejs.org → pilih "LTS"
2. Install (next-next-next)
3. Buka Command Prompt / PowerShell
4. Cek: `node --version`

**Mac:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 1: Masuk ke Folder Tool
```bash
cd IMAP-CONNECTOR
```

### Step 2: Install Dependency
Tool cuma butuh 1 package tambahan: `imapflow` (buat IMAP auto-verify).

```bash
npm install imapflow
```

Ini bakal bikin folder `node_modules/` + `package-lock.json`. Normal, ga perlu diutak-atik.

### Step 3: Jalanin Server
```bash
node server.js
```

Output:
```
╔══════════════════════════════════════════╗
║  IMAP Connector v4.0 (FULL AUTO)        ║
╚══════════════════════════════════════════╝

🚀  http://0.0.0.0:4444
📖  http://0.0.0.0:4444/guide
❤️  http://0.0.0.0:4444/health
```

### Step 4: Buka di Browser
Buka:
```
http://localhost:4444
```

Kalau lu jalanin di VPS (server), buka `http://IP_VPS:4444` dari browser lu.

### Step 5: Isi Form + Klik Setup

1. **Cloudflare API Key** — paste Global API Key dari CF
2. **Account Email** — email login Cloudflare lu
3. **Domains** — 1 domain per baris
4. **Destination Email** — email inbox lu (yang mau nerima semua email)
5. **IMAP Provider** — pilih (Gmail/Outlook/Yahoo/dll)
6. **IMAP Username** — email lu (biasanya sama dengan destination)
7. **IMAP Password** — App Password (Gmail/Yahoo) atau password biasa (Outlook)

Klik **"🚀 Full Auto Setup"** → tunggu → done.

---

## Cara Setup di Berbagai Environment

### Windows (WSL - Windows Subsystem for Linux)

**Install WSL:**
```powershell
# Buka PowerShell as Administrator
wsl --install
```
Restart PC. Buka "Ubuntu" dari Start Menu.

**Di WSL:**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone + run
git clone https://github.com/sirenwontdie/IMAP-CONNECTOR.git
cd IMAP-CONNECTOR
npm install imapflow
node server.js
```

Buka `http://localhost:4444` di browser Windows lu.

### Linux (VPS / Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone + run
git clone https://github.com/sirenwontdie/IMAP-CONNECTOR.git
cd IMAP-CONNECTOR
npm install imapflow
node server.js
```

**Buat persistent (survive reboot):**
```bash
sudo npm install -g pm2
pm2 start server.js --name imap-connector
pm2 save
pm2 startup    # ikutin instruksi yang muncul
```

Sekarang tool auto-start pas VPS reboot. Cek status: `pm2 status`.  
Lihat log: `pm2 logs imap-connector`.  
Stop: `pm2 stop imap-connector`.  
Restart: `pm2 restart imap-connector`.

### macOS

```bash
# Install Node.js
brew install node

# Clone + run
git clone https://github.com/sirenwontdie/IMAP-CONNECTOR.git
cd IMAP-CONNECTOR
npm install imapflow
node server.js
```

### Docker (Opsional)

Buat file `Dockerfile` di folder tool:
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json .
RUN npm install imapflow
COPY . .
EXPOSE 4444
CMD ["node", "server.js"]
```

Build + run:
```bash
docker build -t imap-connector .
docker run -p 4444:4444 imap-connector
```

---

## Port Udah Kepake?

Default port: **4444**. Kalau udah dipake aplikasi lain, tool bakal error `EADDRINUSE`.

### Cek Apa yang Make Port 4444

**Linux/Mac:**
```bash
lsof -i :4444
```

**Windows (Command Prompt):**
```cmd
netstat -ano | findstr :4444
```

### Ganti Port Tool

**Opsi 1: Environment Variable (paling gampang)**
```bash
PORT=5555 node server.js
```

**Opsi 2: Edit `server.js`**

Buka `server.js`, cari baris ini (sekitar line 23):
```js
const PORT = process.env.PORT || 4444;
```
Ganti `4444` jadi port yang lu mau, contoh `5555`:
```js
const PORT = process.env.PORT || 5555;
```
Save → jalanin lagi: `node server.js`.

### Kill Process yang Make Port

**Linux/Mac:**
```bash
kill -9 $(lsof -t -i :4444)
```

**Windows:**
```cmd
taskkill /PID <PID> /F
```
(`<PID>` = angka yang muncul dari `netstat` tadi)

---

## Endpoint Tool

Setelah server jalan, ini yang bisa diakses:

| URL | Apa Isinya |
|---|---|
| `http://localhost:4444/` | Homepage / Setup form |
| `http://localhost:4444/guide` | Guide setup domain di Cloudflare |
| `http://localhost:4444/app-password` | Guide bikin Gmail App Password |
| `http://localhost:4444/tutorial` | Tutorial (markdown) |
| `http://localhost:4444/health` | Health check (JSON) |
| `http://localhost:4444/guide-part1.html` | Guide Part 1 |
| `http://localhost:4444/guide-part2.html` | Guide Part 2 |
| `http://localhost:4444/guide-part3.html` | Guide Part 3 |

API endpoints:
- `POST /api/test` — test credentials CF + IMAP sebelum setup
- `POST /api/setup` — full auto setup (streaming progress)

---

## IMAP Provider yang Didukung

| Provider | Host | Port | TLS | Password |
|---|---|---|---|---|
| **Gmail** | `imap.gmail.com` | 993 | Yes | App Password (16 chars) |
| **Outlook** | `outlook.office365.com` | 993 | Yes | Password biasa |
| **Yahoo** | `imap.mail.yahoo.com` | 993 | Yes | App Password |
| **ProtonMail** | `127.0.0.1` | 1143 | No | Bridge password |
| **Custom** | bebas | 993/143 | varies | sesuai provider |

---

## Cara Auto-Verify Kerja

Cloudflare butuh verifikasi email pas lu add destination address. Mereka kirim email berisi link verifikasi. Biasanya lu harus buka inbox + klik link manual.

**Tool ini otomatisin itu:**

1. Tool tambah destination via Cloudflare API
2. Cloudflare kirim email verifikasi ke alamat itu
3. Tool connect ke IMAP inbox lu
4. Tool polling inbox (sampai 2 menit) cari email dari Cloudflare
5. Tool extract link verifikasi dari isi email
6. Tool visit link itu (ikutin redirect) → destination jadi "Verified"
7. Tool lanjut set catch-all rule

**IMAP credentials cuma dipake 1x buat verifikasi.** Setelah itu, Cloudflare handle semua forwarding. Lu bisa revoke App Password abis setup selesai kalo mau.

---

## Troubleshooting

### "Domain not found in Cloudflare"
- Domain belum di-add ke CF, atau nameserver belum propagasi
- Cek: https://www.whatsmydns.net (NS records)
- Tunggu status "Active" di CF dashboard

### "CF credential check failed"
- API key atau email salah
- API key: `dash.cloudflare.com → Profile → API Tokens → Global API Key`
- Harus **Global API Key** (bukan API Token)

### IMAP connection failed
- **Gmail:** butuh App Password, bukan password biasa. Lihat guide App Password di atas
- 2FA harus ON sebelum bisa bikin App Password
- **Yahoo:** sama, butuh App Password
- **Outlook:** password biasa works

### "Verification email not found"
- Email Cloudflare mungkin masuk folder Spam
- Destination email harus sama dengan IMAP inbox
- Tool polling 2 menit — kalau email delayed, re-run setelah email datang

### Email forwarding ga jalan setelah setup
- DNS propagation butuh waktu 5-30 menit setelah MX records dibuat
- Cek catch-all rule enabled di CF dashboard
- Pastikan destination email status "Verified" di CF

### Port 4444 udah kepake
- Lihat section "Port Udah Kepake?" di atas
- Atau: `PORT=5555 node server.js`

---

## Security Notes

- IMAP credentials dipake in-memory aja, **ga disimpan** ke disk
- Setelah setup selesai, App Password bisa lu revoke (Google Account → App Passwords → Delete)
- Cloudflare API key dipake buat session itu aja, ga di-persist
- Tool ga nyimpen credentials apa-apa ke file
- Semua komunikasi ke Cloudflare API via HTTPS
- IMAP connection pake TLS (port 993)
- Ga ada telemetry, ga ada tracking, ga ada data ke server luar

---

## FAQ

### Q: Git clone aman ga?
**A:** AMAN. Git clone = download code dari GitHub. Code-nya public, lu bisa baca semua di `server.js`. Ga ada yang di-install ke system, ga ada malware, ga ada backdoor. Setelah clone, lu bisa inspect code sendiri sebelum jalanin.

### Q: Tool ini butuh internet?
**A:** Ya. Tool panggil Cloudflare API (butuh internet) + connect ke IMAP server lu (butuh internet). Tapi tool sendiri jalan di local/VPS lu, bukan di cloud.

### Q: Bisa pake domain gratisan (Freenom, dll)?
**A:** Bisa, asal domainnya udah di-add ke Cloudflare + status Active. Tool ga peduli dari mana domain asalnya.

### Q: Berapa domain maksimal yang bisa setup sekali jalan?
**A:** Ga ada limit dari tool. Limit dari Cloudflare API: ~1200 request per 5 menit. 1 domain = ~5 request, jadi ~240 domain per 5 menit. Lebih dari cukup.

### Q: Setelah setup, IMAP password masih dibutuhkan?
**A:** TIDAK. IMAP password cuma dipake 1x buat verifikasi Cloudflare. Setelah verified, Cloudflare handle forwarding. App Password bisa lu revoke.

### Q: Bisa pake email yang sama buat multiple domain?
**A:** BISA. 1 destination email bisa terima dari unlimited domain. Setup domain A + domain B, keduanya forward ke email yang sama.

### Q: Apa tool nyimpan credentials saya?
**A:** TIDAK. Semua credentials (API key, IMAP password) dipake in-memory pas runtime. Pas tool di-restart, hilang. Ga ada yang di-write ke disk. Lu bisa cek sendiri code-nya.

### Q: Cloudflare API Key vs API Token, apa bedanya?
**A:** 
- **Global API Key** = akses penuh ke semua domain di akun lu. Yang tool butuhkan.
- **API Token** = scoped, akses terbatas. Lebih aman tapi ribet setup permission-nya.
- Tool ini pake Global API Key karena lebih simpel buat user awam.

### Q: Kalau VPS reboot, tool masih jalan?
**A:** Kalau pake PM2 (liat guide VPS di atas) → YA, auto-start. Kalau jalanin `node server.js` biasa → TIDAK, harus dijalankan manual lagi.

---

## Tech Stack

- **Node.js** — runtime
- **http** — built-in HTTP server (no Express)
- **https** — Cloudflare API + verification link
- **imapflow** — IMAP client buat auto-verify

Ga ada database. Ga ada external services. Ga ada telemetry. Pure local tool.

---

## License

MIT — pake buat apa aja.

---

## Author

Built by Remm.  
Repo: https://github.com/sirenwontdie/IMAP-CONNECTOR
