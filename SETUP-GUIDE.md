# IMAP Connector - Universal Setup Guide
## For ANY User, ANY Domain, ANY Email

---

## 🎯 What You'll Get

**Result:** ALL emails to `*@yourdomain.com` → your inbox (Gmail/Outlook/any)

**Time:** 10-15 minutes (first time setup)

**Works for:** Unlimited domains after first setup

---

## 📋 What You Need

Before starting, prepare:
1. ✅ Domain (any registrar: Namecheap, GoDaddy, etc)
2. ✅ Cloudflare account (free signup: https://dash.cloudflare.com/sign-up)
3. ✅ Email inbox (Gmail, Outlook, Yahoo, any email)

---

## PART 1: Add Domain to Cloudflare (One-Time Per Domain)

### Step 1.1: Login Cloudflare
- Go to: https://dash.cloudflare.com
- Login or sign up

### Step 1.2: Add Site
- Click **"Add a Site"** button (top right, blue button)
- Enter your domain (example: `mydomain.com`)
- Click **"Add site"**
- Choose **"Free"** plan → Continue

### Step 1.3: Copy Nameservers
Cloudflare shows 2 nameservers like:
```
elijah.ns.cloudflare.com
pola.ns.cloudflare.com
```
**Copy these 2 nameservers** (you'll need them next)

### Step 1.4: Change Nameservers at Registrar

Login to where you bought the domain:

**Namecheap:**
1. Domain List → Manage
2. Nameservers → Custom DNS
3. Paste 2 Cloudflare nameservers
4. Save

**GoDaddy:**
1. My Products → Domains → DNS
2. Nameservers → Change → Custom
3. Paste 2 Cloudflare nameservers
4. Save

**Hostinger:**
1. Domains → Manage → Nameservers
2. Change Nameservers → Custom
3. Paste 2 Cloudflare nameservers
4. Save

### Step 1.5: Wait for Propagation
- Back to Cloudflare → Click **"Done, check nameservers"**
- Wait 5-60 minutes (usually 10-15 min)
- Domain status changes to **"Active"** (green badge)
- **Check:** https://www.whatsmydns.net (type: NS, should show Cloudflare nameservers globally)

---

## PART 2: Setup Email Destination (One-Time Per Email)

### Step 2.1: Go to Email Routing
- Cloudflare dashboard → Click your domain
- **Left sidebar** → scroll down → **"Email"**
- Click **"Email Routing"**

**Screenshot location:** Left sidebar, "Email" menu with envelope icon

### Step 2.2: Enable Email Routing (if first time)
- Click **"Get Started"** or **"Enable Email Routing"** button
- Cloudflare auto-creates DNS records
- Click **"Add records and enable"**
- Status shows **"Enabled"** ✅

### Step 2.3: Add Destination Address
- Click tab **"Destination Addresses"** (second tab from left)
- Click **"Create address"** button (blue, top right)
- **Form appears:**
  - Email address: `your-email@gmail.com` (or any email you want)
  - Click **"Save and send verification"**

**Screenshot location:** Tab bar with "Destination Addresses" tab

### Step 2.4: Verify Email
1. Open inbox of the email you just entered
2. Find email from **Cloudflare** (sender: `no-reply@notify.cloudflare.com`)
3. Subject: **"Verify your email address for Cloudflare Email Routing"**
4. Click blue button **"Verify Email Address"**
5. Browser redirects to Cloudflare
6. Status shows **"Verified"** with green checkmark ✅

**Important:** Check spam/junk if you don't see the email

### Step 2.5: Confirm Verified
- Back to Email Routing dashboard
- Tab **"Destination Addresses"**
- You should see:
  - Email: `your-email@gmail.com`
  - Status: **Verified** (green badge) ✅

**Screenshot location:** Destination list showing verified email

---

## PART 3: Get Cloudflare API Key (One-Time)

### Step 3.1: Go to API Tokens
- Cloudflare dashboard → Click profile icon (top right)
- Click **"My Profile"**
- Left sidebar → **"API Tokens"**

### Step 3.2: Get Global API Key
- Scroll down to section **"Global API Key"**
- Click **"View"**
- Enter password to confirm
- **Copy the API key** (starts with `cfk_...`)
- Save it somewhere safe (you'll use this in the tool)

**Screenshot location:** Profile → API Tokens page, "Global API Key" section

---

## PART 4: Use Automation Tool (Unlimited Domains)

### Step 4.1: Open Tool
- URL: http://43.134.72.40:4444

### Step 4.2: Fill Form

**Section 1: Cloudflare**
- **Global API Key:** paste the key from Step 3.2
- **Account Email:** your Cloudflare login email

**Section 2: Domains**
- Enter domain(s), one per line:
```
yourdomain.com
domain2.com
domain3.net
```

**Section 3: Email Destination**
- **Email Address:** the email you verified in Step 2.4

### Step 4.3: Click Setup
- Click **"🚀 Setup All Domains"**
- Wait for progress (10-30 seconds)
- Success message appears ✅

---

## PART 5: Test Email

### Step 5.1: Send Test Email
- From another email (Gmail/Outlook/any)
- Send to: `test@yourdomain.com`
- Subject/body: anything

### Step 5.2: Check Inbox
- Open inbox: the email you set as destination
- Email from `test@yourdomain.com` should arrive in 1-2 minutes ✅

### Step 5.3: Test Random Addresses
All these go to same inbox:
- `random@yourdomain.com`
- `user123@yourdomain.com`
- `anything@yourdomain.com`

---

## ✅ DONE!

**You now have:**
- Catch-all email routing for your domain(s)
- All emails to `*@yourdomain.com` → your inbox
- Ready for bulk account registration, verification emails, multi-account ops

---

## 🔁 Setup Additional Domains

**Already verified email destination? Super fast:**

1. Add new domain to Cloudflare (PART 1)
2. Use tool with same email destination (PART 4)
3. Done! (skip PART 2 - no need to verify again)

**Want different email destination?**
1. Add new domain to Cloudflare (PART 1)
2. Add & verify new destination (PART 2)
3. Use tool with new destination (PART 4)

---

## 🆘 Troubleshooting

**Domain not Active?**
- Check nameservers changed at registrar
- Wait 10-60 minutes for propagation
- Verify via https://www.whatsmydns.net

**Verification email not received?**
- Check spam/junk folder
- Wait 5-10 minutes
- Click "Resend verification" in Cloudflare

**Tool shows error?**
- Confirm destination email is verified
- Check API key is correct
- Ensure domain is Active in Cloudflare

**Email not arriving?**
- Check spam/junk
- Verify routing rule is enabled in Cloudflare
- Wait 2-5 minutes for first email
- Test from external email (not the destination itself)

---

## 📞 Support

Tool URL: http://43.134.72.40:4444
Tutorial: http://43.134.72.40:4444/tutorial

---

**Last Updated:** 2026-07-17
**Version:** 2.0 - Universal Setup
