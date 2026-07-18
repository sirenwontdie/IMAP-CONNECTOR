# IMAP Connector - Complete Setup Guide

## 🎯 Goal
Setup catch-all email routing sehingga **semua email** ke `*@yourdomain.com` masuk ke 1 inbox (Gmail/Outlook/apapun).

---

## 📋 Prerequisites

Yang lu butuh:
- ✅ Domain (beli dari Namecheap/GoDaddy/Niagahoster/dll)
- ✅ Email inbox (Gmail/Outlook/Yahoo/apapun)
- ✅ Akun Cloudflare (free)

---

## 🚀 Step-by-Step Setup

### STEP 1: Add Domain ke Cloudflare

**1.1. Bikin akun Cloudflare (kalo belum punya)**
- Buka: https://dash.cloudflare.com/sign-up
- Daftar pake email
- Verify email
- Login

**1.2. Add domain ke Cloudflare**
- Login ke https://dash.cloudflare.com
- Klik **"Add a Site"** (tombol biru kanan atas)
- Masukin domain lu (contoh: `alltesting.online`)
- Klik **"Add site"**
- Pilih plan **"Free"** → Continue

**1.3. Review DNS records**
- Cloudflare auto-import DNS records dari domain lu
- Klik **"Continue"**

**1.4. Ganti nameserver di registrar**

Cloudflare kasih 2 nameserver, contoh:
```
elijah.ns.cloudflare.com
pola.ns.cloudflare.com
```

**Login ke registrar domain lu:**

**Namecheap:**
- Dashboard → Domain List → Manage
- Nameservers → Custom DNS
- Paste 2 nameserver dari Cloudflare
- Save

**GoDaddy:**
- My Products → Domains → DNS
- Nameservers → Change → Custom
- Paste 2 nameserver dari Cloudflare
- Save

**Niagahoster:**
- Layanan Saya → Domain → Manage
- Name Server → Custom
- Paste 2 nameserver dari Cloudflare
- Simpan

**Hostinger:**
- Domains → Manage → Nameservers
- Change Nameservers → Custom
- Paste 2 nameserver dari Cloudflare
- Save

**1.5. Tunggu propagasi**
- Kembali ke Cloudflare → klik **"Done, check nameservers"**
- Tunggu 5-60 menit (biasanya 10-15 menit)
- Refresh halaman Cloudflare
- Kalo udah **"Active"** (badge hijau/biru) → lanjut step 2

---

### STEP 2: Enable Email Routing di Cloudflare

**2.1. Masuk ke Email Routing**
- Dashboard Cloudflare → https://dash.cloudflare.com
- **Klik domain lu** (contoh: alltesting.online)
- **Sidebar kiri → scroll ke bawah → cari "Email"**
- Klik **"Email Routing"**

**Screenshot:** Sidebar kiri ada menu "Email" dengan icon amplop

**2.2. Enable Email Routing (pertama kali)**
- Kalo belum pernah setup, ada tombol **"Get Started"** atau **"Enable Email Routing"**
- Klik tombol itu
- Cloudflare auto-create DNS records (MX, TXT) → klik **"Add records and enable"**
- Status jadi **"Enabled"** ✅

**2.3. Add Destination Address**
- Di halaman Email Routing, klik tab **"Destination Addresses"** (tab ke-2 dari kiri)
- Klik tombol **"Create address"** (tombol biru, kanan atas)
- **Form muncul:**
  - **Email address:** ketik email tujuan lu (contoh: `remm@gmail.com`)
  - Klik **"Save and send verification"**
- Cloudflare kirim email verification

**2.4. Verify Email**
- **Buka inbox email tujuan** (Gmail/Outlook yang lu masukin tadi)
- Cari email dari **"Cloudflare"** (sender: `no-reply@notify.cloudflare.com`)
- Subject: **"Verify your email address for Cloudflare Email Routing"**
- **Klik tombol "Verify Email Address"** (tombol biru di email)
- Redirect ke Cloudflare → status jadi **"Verified"** ✅

**2.5. Create Catch-All Rule**
- Balik ke Email Routing dashboard
- Klik tab **"Routing rules"** (tab pertama, atau yang active)
- Klik tombol **"Create routing rule"** (tombol biru)
- **Form muncul - isi seperti ini:**
  - **Name:** `Catch-all` (bebas, cuma label)
  - **Rule type:** pilih **"Catch-all address"** (dropdown, pilih yang ini!)
  - **Action:** pilih **"Send to an email"** (udah default)
  - **Destination:** pilih email yang udah verified tadi (dropdown)
- Klik **"Save"**
- Rule jadi **"Enabled"** ✅

**PENTING - Screenshot penjelasan:**
- **Rule type: "Catch-all address"** = semua email ke `*@domain.com` masuk
- **JANGAN pilih "Custom address"** (ini cuma buat email spesifik kayak `support@domain.com`)

**2.6. Verify Setup Complete**
Cek 3 hal ini:
- ✅ Status **"Email Routing: Enabled"**
- ✅ **"Destination addresses: 1"** (atau lebih) + status **"Verified"**
- ✅ **"Routing rules: 1"** (atau lebih) + type **"Catch-all"**

Kalo 3 ini ijo, setup done!

---

### STEP 3: Test Email Routing

**3.1. Kirim test email**
- Buka email lain atau Gmail/Outlook lain
- Kirim email ke: `test@yourdomain.com`
- Subject/body: bebas

**3.2. Check inbox**
- Buka inbox email tujuan (yang lu verify di step 2.3)
- Email dari `test@yourdomain.com` harusnya masuk dalam 1-2 menit
- ✅ Kalo masuk → setup berhasil!

**3.3. Test dengan random address**
- Kirim ke: `random123@yourdomain.com`
- Kirim ke: `anything@yourdomain.com`
- Kirim ke: `xyz@yourdomain.com`
- Semua harusnya masuk ke inbox yang sama

---

## ✅ Done!

Sekarang **SEMUA email** ke `*@yourdomain.com` masuk ke 1 inbox.

**Use case:**
- Bulk registration: `user1@domain.com`, `user2@domain.com`, ... semua masuk ke 1 inbox
- Email verification: terima verification email dari platform apapun
- Multi-account operations: bisa bikin unlimited email address

---

## 🔁 Setup Domain Tambahan

Mau setup domain ke-2, ke-3, dst dengan **inbox yang sama**?

**Cara cepet:**

Ulangi **STEP 1** (add domain ke Cloudflare) + **STEP 2** (enable email routing), tapi:
- Di **STEP 2.2**: pilih destination address yang **udah verified sebelumnya** (ga perlu verify lagi)
- Di **STEP 2.4**: create catch-all rule ke destination yang sama

**Result:**
- `*@domain1.com` → inbox lu
- `*@domain2.com` → inbox lu (sama)
- `*@domain3.com` → inbox lu (sama)

---

## 🛠️ Tool Otomasi (Coming Soon)

Tool di `http://43.134.72.40:4444` bisa otomasi **STEP 2** (enable email routing + create rule), tapi **STEP 1 harus manual** (add domain ke Cloudflare + ganti nameserver).

**Hybrid approach:**
1. Manual: STEP 1 (add domain + nameserver)
2. Auto: STEP 2 (email routing setup via tool)
3. Manual: STEP 2.3 (verify email pertama kali)
4. Auto: STEP 2.4+ (catch-all rule via tool)

---

## ❓ Troubleshooting

**Domain belum Active di Cloudflare?**
- Check nameserver udah diganti belum di registrar
- Tunggu 10-60 menit propagasi
- Check via https://www.whatsmydns.net (type: NS)

**Email ga masuk?**
- Check spam/junk folder
- Check routing rule udah enabled
- Check destination address udah verified
- Test kirim dari email lain (bukan dari inbox tujuan)

**Verification email ga masuk?**
- Check spam/junk
- Tunggu 5-10 menit
- Klik "Resend verification" di Cloudflare

---

## 📞 Support

Kalo stuck atau ada error, screenshot error-nya dan kasih tau:
1. Domain apa
2. Stuck di step mana
3. Error message apa

---

**Last updated:** 2026-07-17
**Version:** 1.0
