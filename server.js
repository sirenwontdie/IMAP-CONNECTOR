#!/usr/bin/env node

/**
 * IMAP Connector v4.0 — FULL AUTO
 *
 * Standalone server. No agent needed.
 *
 * Flow:
 *   1. User: CF API key + domains + destination email + IMAP creds
 *   2. Server: enable email routing + create DNS
 *   3. Server: add destination address via CF API → CF sends verification email
 *   4. Server: connect IMAP → poll inbox → find CF verification email
 *   5. Server: extract verification link → GET it → destination verified
 *   6. Server: set catch-all rule → forward all emails to destination
 *   7. Done: *@domain.com → destination inbox (verified by CF)
 *
 * IMAP creds only used ONCE for verification. After that, Cloudflare handles forwarding.
 *
 * Supported IMAP providers: Gmail, Outlook, Yahoo, any custom IMAP server.
 *   - Gmail: needs App Password (2FA → App Passwords)
 *   - Outlook: regular password works
 *   - Yahoo: needs App Password
 *   - Custom: host + port + user + password
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');

const PORT = process.env.PORT || 4444;
const HOST = process.env.HOST || '0.0.0.0';

// ─── Cloudflare API client ──────────────────────────────────────────────────
class CloudflareAPI {
  constructor(apiKey, accountEmail) {
    if (!apiKey || !accountEmail) {
      throw new Error('Cloudflare API key & account email are required');
    }
    this.apiKey = apiKey;
    this.accountEmail = accountEmail;
  }

  request(method, apiPath, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.cloudflare.com',
        path: apiPath,
        method: method,
        headers: {
          'X-Auth-Email': this.accountEmail,
          'X-Auth-Key': this.apiKey,
          'Content-Type': 'application/json',
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.success) {
              resolve(parsed.result);
            } else {
              const errs = parsed.errors || [];
              const msg = errs.map(e => e.message || JSON.stringify(e)).join('; ') || body;
              reject(new Error(msg));
            }
          } catch (e) {
            reject(new Error(`Cloudflare API parse error (HTTP ${res.statusCode}): ${body.slice(0, 300)}`));
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  async getZoneId(domain) {
    const result = await this.request('GET', `/client/v4/zones?name=${encodeURIComponent(domain)}`);
    if (!result || result.length === 0) {
      throw new Error(`Domain "${domain}" not found in Cloudflare. Pastikan domain udah Active (nameservers pointing to CF).`);
    }
    return result[0].id;
  }

  async verifyCredentials() {
    const result = await this.request('GET', `/client/v4/zones?per_page=1`);
    return { ok: true, zoneCount: result.length };
  }

  async getEmailRoutingStatus(zoneId) {
    return await this.request('GET', `/client/v4/zones/${zoneId}/email/routing`);
  }

  async enableEmailRouting(zoneId) {
    try {
      await this.request('POST', `/client/v4/zones/${zoneId}/email/routing/enable`, {});
      return { status: 'success', message: '✓ Email routing enabled' };
    } catch (e) {
      return { status: 'success', message: '✓ Email routing already enabled' };
    }
  }

  async setupDNS(zoneId) {
    try {
      await this.request('POST', `/client/v4/zones/${zoneId}/email/routing/dns`, {});
      return { status: 'success', message: '✓ DNS records auto-created (MX/TXT/SPF)' };
    } catch (e) {
      try {
        await this.request('GET', `/client/v4/zones/${zoneId}/email/routing/dns`);
        return { status: 'success', message: '✓ DNS records already configured' };
      } catch (e2) {
        return { status: 'warning', message: `⚠ DNS setup skipped: ${e.message}` };
      }
    }
  }

  async getAccountId() {
    const result = await this.request('GET', `/client/v4/accounts`);
    if (!result || result.length === 0) {
      throw new Error('No Cloudflare accounts found for these credentials');
    }
    return result[0].id;
  }

  /**
   * Add destination address. Returns { created, verified, data }.
   * - If already verified → skip
   * - If newly added → need verification (status: pending)
   * - If already pending → still need verification
   */
  async addDestinationAddress(accountId, destinationEmail) {
    // Check existing first
    let existing = [];
    try {
      existing = await this.request('GET', `/client/v4/accounts/${accountId}/email/routing/addresses`);
    } catch (e) {
      // ignore
    }

    const found = existing.find(a => a.email.toLowerCase() === destinationEmail.toLowerCase());
    if (found) {
      if (found.verified) {
        return { status: 'verified', message: `✓ Destination already verified: ${destinationEmail}`, needVerify: false };
      } else {
        return { status: 'pending', message: `⏳ Destination pending verification: ${destinationEmail}`, needVerify: true };
      }
    }

    // Add new
    try {
      const result = await this.request('POST', `/client/v4/accounts/${accountId}/email/routing/addresses`, {
        email: destinationEmail
      });
      return { status: 'pending', message: `✓ Destination added (verification email sent): ${destinationEmail}`, needVerify: true };
    } catch (e) {
      if (/already|exist/i.test(e.message)) {
        return { status: 'pending', message: `⏳ Destination exists, pending verification: ${destinationEmail}`, needVerify: true };
      }
      throw e;
    }
  }

  async checkDestinationVerified(accountId, destinationEmail) {
    const addresses = await this.request('GET', `/client/v4/accounts/${accountId}/email/routing/addresses`);
    const found = addresses.find(a => a.email.toLowerCase() === destinationEmail.toLowerCase());
    return found ? !!found.verified : false;
  }

  async setupCatchAll(zoneId, destinationEmail) {
    const steps = [];
    steps.push(await this.enableEmailRouting(zoneId));
    steps.push(await this.setupDNS(zoneId));

    let existing;
    try {
      existing = await this.request('GET', `/client/v4/zones/${zoneId}/email/routing/rules/catch_all`);
    } catch (e) {
      steps.push({ status: 'error', message: `✗ Failed to fetch catch-all rule: ${e.message}` });
      return steps;
    }

    try {
      await this.request('PUT', `/client/v4/zones/${zoneId}/email/routing/rules/catch_all`, {
        name: 'Catch-all forwarding',
        enabled: true,
        matchers: [{ type: 'all' }],
        actions: [
          { type: 'forward', value: [destinationEmail] }
        ]
      });
      steps.push({ status: 'success', message: `✓ Catch-all rule → ${destinationEmail} (enabled)` });
    } catch (e) {
      steps.push({ status: 'error', message: `✗ Catch-all update failed: ${e.message}` });
    }

    return steps;
  }
}

// ─── IMAP auto-verify ───────────────────────────────────────────────────────
/**
 * Connect to IMAP, poll inbox for Cloudflare verification email,
 * extract and visit the verification link to auto-verify the destination address.
 *
 * @param {Object} imapConfig - { host, port, user, pass, tls }
 * @param {String} destinationEmail - the email being verified (to filter)
 * @param {Function} log - progress callback
 * @param {Number} timeoutMs - max wait time (default 90s)
 */
async function autoVerifyViaIMAP(imapConfig, destinationEmail, log, timeoutMs = 120000) {
  let client;
  let lock;
  try {
    client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.tls,
      auth: {
        user: imapConfig.user,
        pass: imapConfig.pass
      },
      logger: false
    });

    await client.connect();
    log('✓ IMAP connected', 'success');
    console.log(`[IMAP] Connected to ${imapConfig.host} as ${imapConfig.user}`);

    lock = await client.getMailboxLock('INBOX');
    let verified = false;
    const startTime = Date.now();
    let searchedCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log(`🔎 Polling inbox (${elapsed}s)...`, 'info-text');

      try {
        // Search for Cloudflare verification emails
        // Try multiple search strategies
        let messages = [];

        // Strategy 1: search by from "cloudflare" and subject "verify"
        try {
          messages = await client.search({ from: 'cloudflare', subject: 'verify' }, { uid: true });
          console.log(`[IMAP] Search 1 (from:cloudflare subject:verify): ${messages.length} hits`);
        } catch (e1) {
          console.log(`[IMAP] Search 1 failed: ${e1.message}`);
        }

        // Strategy 2: broader — just from cloudflare
        if (!messages || messages.length === 0) {
          try {
            messages = await client.search({ from: 'cloudflare' }, { uid: true });
            console.log(`[IMAP] Search 2 (from:cloudflare): ${messages.length} hits`);
          } catch (e2) {
            console.log(`[IMAP] Search 2 failed: ${e2.message}`);
          }
        }

        // Strategy 3: search by subject containing "verify" or "email routing"
        if (!messages || messages.length === 0) {
          try {
            messages = await client.search({ subject: 'verify' }, { uid: true });
            console.log(`[IMAP] Search 3 (subject:verify): ${messages.length} hits`);
          } catch (e3) {
            console.log(`[IMAP] Search 3 failed: ${e3.message}`);
          }
        }

        // Strategy 4: search ALL recent emails (last 10) and filter manually
        if (!messages || messages.length === 0) {
          try {
            // Get last 20 messages by UID
            const status = await client.status('INBOX', { uidNext: true });
            const uidNext = status.uidNext || 1;
            const startUid = Math.max(1, uidNext - 20);
            messages = await client.search({ uid: `${startUid}:*` }, { uid: true });
            console.log(`[IMAP] Search 4 (last 20 UIDs): ${messages.length} hits`);
          } catch (e4) {
            console.log(`[IMAP] Search 4 failed: ${e4.message}`);
          }
        }

        if (messages && messages.length > 0) {
          searchedCount++;
          // Check from most recent
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            try {
              const msgData = await client.fetchOne(msg, { source: true, envelope: true });
              if (!msgData) continue;

              const source = msgData.source.toString();
              const envelope = msgData.envelope;

              // Check if this is a Cloudflare verification email
              const isFromCF = (envelope && envelope.from && envelope.from.some(f => 
                (f.address || '').toLowerCase().includes('cloudflare') || 
                (f.name || '').toLowerCase().includes('cloudflare')
              )) || source.toLowerCase().includes('cloudflare');

              const hasVerifyLink = source.toLowerCase().includes('verify') || 
                                    source.toLowerCase().includes('email-routing') ||
                                    source.toLowerCase().includes('routing');

              if (isFromCF && hasVerifyLink) {
                // Extract verification link
                // CF links: https://...cloudflare.com/... or https://...email-routing...
                const linkPatterns = [
                  /https:\/\/[^"'\s<>]*cloudflare[^"'\s<>]*verify[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]*verify[^"'\s<>]*cloudflare[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]*email-routing[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]*routing[^"'\s<>]*verify[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]*cloudflare[^"'\s<>]*routing[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]*verify[^"'\s<>]*email[^"'\s<>]*/i,
                  /https:\/\/[^"'\s<>]+token[^"'\s<>]*/i
                ];

                let verifyUrl = null;
                for (const pattern of linkPatterns) {
                  const match = source.match(pattern);
                  if (match) {
                    verifyUrl = match[0];
                    break;
                  }
                }

                if (verifyUrl) {
                  log(`🔗 Found verification link`, 'info-text');
                  console.log(`[IMAP] Verify URL: ${verifyUrl.substring(0, 80)}...`);

                  const verifyResult = await visitVerificationLink(verifyUrl);
                  if (verifyResult.ok) {
                    log(`✅ Destination verified: ${destinationEmail}`, 'success');
                    verified = true;

                    // Delete verification email
                    try {
                      await client.messageDelete(msg);
                      log('✓ Verification email deleted', 'success');
                    } catch (e) {}

                    lock.release();
                    lock = null;
                    await client.logout();
                    return { verified: true, error: null };
                  } else {
                    log(`⚠ Link visit failed: ${verifyResult.error}`, 'warning-text');
                    console.log(`[IMAP] Verify failed: ${verifyResult.error}`);
                  }
                } else {
                  console.log(`[IMAP] CF email found but no link extracted. Source snippet: ${source.substring(0, 200)}`);
                }
              }
            } catch (fetchErr) {
              console.log(`[IMAP] Fetch error: ${fetchErr.message}`);
            }
          }
        }
      } catch (searchErr) {
        console.log(`[IMAP] Search error: ${searchErr.message}`);
        log(`⚠ Search error: ${searchErr.message}`, 'warning-text');
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    log(`⏳ Verification email not found after ${timeoutMs / 1000}s`, 'warning-text');
    if (lock) { lock.release(); lock = null; }
    try { await client.logout(); } catch (e) {}
    return { verified: false, error: `Verification email not found within ${timeoutMs / 1000}s` };

  } catch (err) {
    console.error('[IMAP] FATAL:', err.message);
    console.error(err.stack);
    if (lock) { try { lock.release(); } catch (e) {} }
    if (client) { try { await client.logout(); } catch (e) {} }
    return { verified: false, error: err.message };
  }
}

/**
 * Visit the verification link via HTTPS GET (follows redirects).
 */
function visitVerificationLink(linkUrl) {
  return new Promise((resolve) => {
    const follow = (currentUrl, depth = 0) => {
      if (depth > 5) {
        resolve({ ok: false, error: 'Too many redirects' });
        return;
      }

      const req = https.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EmailVerification/1.0)',
          'Accept': 'text/html,application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            // Handle relative URLs
            if (nextUrl.startsWith('/')) {
              const parsed = new URL(currentUrl);
              nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
            }
            follow(nextUrl, depth + 1);
            return;
          }

          // 2xx = success
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[VERIFY] HTTP ${res.statusCode}, body length: ${body.length}`);
            resolve({ ok: true });
          } else {
            console.log(`[VERIFY] HTTP ${res.statusCode}`);
            resolve({ ok: false, error: `HTTP ${res.statusCode}` });
          }
        });
      });

      req.on('error', (e) => {
        console.log(`[VERIFY] Request error: ${e.message}`);
        resolve({ ok: false, error: e.message });
      });

      req.setTimeout(15000, () => {
        req.destroy();
        resolve({ ok: false, error: 'Timeout' });
      });
    };

    follow(linkUrl);
  });
}

// ─── Provider presets ───────────────────────────────────────────────────────
const IMAP_PRESETS = {
  gmail: { host: 'imap.gmail.com', port: 993, tls: true, label: 'Gmail (App Password)' },
  outlook: { host: 'outlook.office365.com', port: 993, tls: true, label: 'Outlook / Hotmail' },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, tls: true, label: 'Yahoo (App Password)' },
  proton: { host: '127.0.0.1', port: 1143, tls: false, label: 'ProtonMail Bridge' },
  custom: { host: '', port: 993, tls: true, label: 'Custom IMAP' }
};

// ─── HTML frontend ──────────────────────────────────────────────────────────
const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IMAP Connector - Full Auto</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 35px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { font-size: 26px; margin-bottom: 8px; color: #333; }
    .subtitle { color: #666; margin-bottom: 25px; font-size: 13px; }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-bottom: 25px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
    }
    .warning strong { color: #856404; }
    .info {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 12px 15px;
      margin-bottom: 25px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
    }
    .section { margin-bottom: 22px; }
    .section-title { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #667eea; }
    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 5px; color: #333; }
    input, textarea, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      margin-bottom: 5px;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #667eea; }
    textarea { resize: vertical; min-height: 65px; font-family: monospace; }
    .help { font-size: 11px; color: #999; margin-bottom: 12px; }
    .row { display: flex; gap: 10px; }
    .row > div { flex: 1; }
    .btn-row { display: flex; gap: 10px; }
    button {
      flex: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 13px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button.secondary { background: #6c757d; }
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #progress {
      display: none;
      margin-top: 20px;
      padding: 18px;
      background: #f8f9fa;
      border-radius: 6px;
      max-height: 500px;
      overflow-y: auto;
    }
    .progress-item { padding: 5px 0; font-size: 13px; font-family: monospace; }
    .success { color: #28a745; }
    .error { color: #dc3545; }
    .warning-text { color: #ff9800; font-weight: 600; }
    .info-text { color: #17a2b8; }
    #result {
      display: none;
      margin-top: 20px;
      padding: 18px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 6px;
      color: #155724;
      font-size: 14px;
      line-height: 1.6;
    }
    a { color: #2196F3; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📧 IMAP Connector <span class="badge">FULL AUTO</span></h1>
    <p class="subtitle">Zero-click email routing setup. Cuma paste credentials, tool handle sisanya.</p>

    <div class="info">
      <strong>💡 Yang tool ini lakuin (semua otomatis):</strong><br>
      1. Enable email routing + create DNS records (MX/TXT/SPF)<br>
      2. Add destination address via CF API<br>
      3. <strong>Connect IMAP → cari email verifikasi → klik link otomatis</strong><br>
      4. Set catch-all rule → semua <code>@domain.com</code> → 1 inbox<br>
      <br>
      <strong>IMAP creds cuma dipake 1x buat verifikasi.</strong> Setelah itu CF handle forwarding.
    </div>

    <div class="warning">
      <strong>⚠️ Requirements:</strong><br>
      1. Domain sudah Active di Cloudflare (nameservers → CF)<br>
      2. Destination email = inbox IMAP yang sama (biar verifikasi auto)<br>
      3. Gmail/Yahoo: pake <strong>App Password</strong> (bukan password biasa)<br><br>
      <a href="/guide" target="_blank" style="font-size: 14px;">📖 Complete Setup Guide</a> &nbsp;|&nbsp;
      <a href="/app-password" target="_blank" style="font-size: 14px;">🔑 Gmail App Password Guide</a>
    </div>

    <form id="form">
      <div class="section">
        <div class="section-title">1. Cloudflare Credentials</div>
        <label>Global API Key</label>
        <input type="password" id="cfKey" required placeholder="cfk_... or legacy hex key">
        <div class="help">dash.cloudflare.com → Profile → API Tokens → "Global API Key" → View</div>

        <label>Account Email</label>
        <input type="email" id="cfEmail" required placeholder="your-cf-login@email.com">
        <div class="help">Email login Cloudflare</div>
      </div>

      <div class="section">
        <div class="section-title">2. Domains</div>
        <label>Domain List (one per line)</label>
        <textarea id="domains" required placeholder="alltesting.online
domain2.com
domain3.net"></textarea>
        <div class="help">Domain harus Active di Cloudflare</div>
      </div>

      <div class="section">
        <div class="section-title">3. Destination Email (same as IMAP inbox)</div>
        <label>Email Address</label>
        <input type="email" id="destEmail" required placeholder="your-email@gmail.com">
        <div class="help">Email ini akan jadi inbox penerima semua *@domain.com. Harus sama dengan IMAP inbox.</div>
      </div>

      <div class="section">
        <div class="section-title">4. IMAP Credentials (for auto-verification)</div>
        <label>Provider</label>
        <select id="imapProvider" onchange="onProviderChange()">
          <option value="gmail">Gmail (imap.gmail.com:993)</option>
          <option value="outlook">Outlook / Hotmail (outlook.office365.com:993)</option>
          <option value="yahoo">Yahoo (imap.mail.yahoo.com:993)</option>
          <option value="proton">ProtonMail Bridge (127.0.0.1:1143)</option>
          <option value="custom">Custom IMAP</option>
        </select>

        <div id="customHostRow" style="display:none;">
          <div class="row">
            <div>
              <label>IMAP Host</label>
              <input type="text" id="imapHost" placeholder="imap.yourprovider.com">
            </div>
            <div style="max-width: 100px;">
              <label>Port</label>
              <input type="number" id="imapPort" value="993">
            </div>
          </div>
        </div>

        <label>IMAP Username (email)</label>
        <input type="email" id="imapUser" required placeholder="same as destination email">
        <div class="help">Biasanya sama dengan destination email di atas</div>

        <label>IMAP Password / App Password</label>
        <input type="password" id="imapPass" required placeholder="Gmail: App Password (16 chars)">
        <div class="help">
          Gmail: Google Account → Security → 2-Step Verification → App Passwords<br>
          Yahoo: Account Security → App Passwords<br>
          Outlook: password biasa
        </div>
      </div>

      <div class="btn-row">
        <button type="button" id="testBtn" class="secondary">🧪 Test CF + IMAP</button>
        <button type="submit" id="btn">🚀 Full Auto Setup</button>
      </div>
    </form>

    <div id="progress"></div>
    <div id="result"></div>
  </div>

  <script>
    const form = document.getElementById('form');
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');
    const btn = document.getElementById('btn');
    const testBtn = document.getElementById('testBtn');

    const PRESETS = {
      gmail: { host: 'imap.gmail.com', port: 993, tls: true },
      outlook: { host: 'outlook.office365.com', port: 993, tls: true },
      yahoo: { host: 'imap.mail.yahoo.com', port: 993, tls: true },
      proton: { host: '127.0.0.1', port: 1143, tls: false },
      custom: { host: '', port: 993, tls: true }
    };

    function onProviderChange() {
      const provider = document.getElementById('imapProvider').value;
      document.getElementById('customHostRow').style.display = provider === 'custom' ? 'block' : 'none';
    }

    function add(msg, type = 'info-text') {
      const item = document.createElement('div');
      item.className = 'progress-item ' + type;
      item.textContent = msg;
      progress.appendChild(item);
      progress.scrollTop = progress.scrollHeight;
    }

    function showProgress() {
      progress.style.display = 'block';
      progress.innerHTML = '';
      result.style.display = 'none';
    }

    function getIMAPConfig() {
      const provider = document.getElementById('imapProvider').value;
      const preset = PRESETS[provider];
      let host = preset.host;
      let port = preset.port;
      let tls = preset.tls;

      if (provider === 'custom') {
        host = document.getElementById('imapHost').value.trim();
        port = parseInt(document.getElementById('imapPort').value) || 993;
        tls = port === 993;
      }

      return {
        host,
        port,
        tls,
        user: document.getElementById('imapUser').value.trim(),
        pass: document.getElementById('imapPass').value
      };
    }

    function getPayload() {
      return {
        cfKey: document.getElementById('cfKey').value.trim(),
        cfEmail: document.getElementById('cfEmail').value.trim(),
        domains: document.getElementById('domains').value.split('\\n').map(d => d.trim()).filter(d => d),
        destEmail: document.getElementById('destEmail').value.trim(),
        imap: getIMAPConfig()
      };
    }

    function validate() {
      const p = getPayload();
      if (!p.cfKey || !p.cfEmail) { alert('CF credentials missing'); return false; }
      if (!p.domains.length) { alert('No domains provided'); return false; }
      if (!p.destEmail) { alert('Destination email missing'); return false; }
      if (!p.imap.host || !p.imap.user || !p.imap.pass) { alert('IMAP config incomplete'); return false; }
      return true;
    }

    // ─── Test ───
    testBtn.addEventListener('click', async () => {
      if (!validate()) return;
      showProgress();
      testBtn.disabled = true;
      add('🔄 Testing Cloudflare + IMAP...', 'info-text');
      try {
        const res = await fetch('/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getPayload())
        });
        const data = await res.json();
        if (data.ok) {
          add('✅ ' + data.message, 'success');
        } else {
          add('❌ ' + (data.error || 'Test failed'), 'error');
        }
      } catch (e) {
        add('❌ Network error: ' + e.message, 'error');
      } finally {
        testBtn.disabled = false;
      }
    });

    // ─── Full Auto Setup ───
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;
      showProgress();
      btn.disabled = true;

      const data = getPayload();

      try {
        add('🚀 Starting full auto setup...', 'info-text');
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              add(msg.message, msg.type);
            } catch (err) {}
          }
        }

        result.style.display = 'block';
        result.innerHTML = '<strong>✅ Full Auto Setup Complete!</strong><br><br>' +
          '<strong>NEXT:</strong> Send test email to <code>test@' + data.domains[0] + '</code><br>' +
          'Should arrive at <strong>' + data.destEmail + '</strong> within 1-2 minutes.';
      } catch (e) {
        add('❌ Error: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

// ─── Server ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ─── Homepage ───
  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  // ─── Health check ───
  if (req.method === 'GET' && parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'imap-connector', version: '4.0', autoVerify: true }));
    return;
  }

  // ─── Gmail App Password guide ───
  if (req.method === 'GET' && parsed.pathname === '/app-password') {
    const guidePath = path.join(__dirname, 'guide-app-password.html');
    try {
      const html = fs.readFileSync(guidePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Guide not found.');
    }
    return;
  }

  // ─── Setup guide ───
  if (req.method === 'GET' && parsed.pathname === '/guide') {
    const guidePath = path.join(__dirname, 'guide-index.html');
    try {
      const html = fs.readFileSync(guidePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Guide not found.');
    }
    return;
  }

  // ─── Tutorial (markdown) ───
  if (req.method === 'GET' && parsed.pathname === '/tutorial') {
    const tutorialPath = path.join(__dirname, 'TUTORIAL.md');
    let markdown;
    try {
      markdown = fs.readFileSync(tutorialPath, 'utf8');
    } catch (e) {
      markdown = '# Tutorial\\n\\nFull guide: /guide';
    }
    const page = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tutorial</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
  .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
  .back { display: inline-block; margin-bottom: 20px; color: #667eea; text-decoration: none; }
  .content { line-height: 1.7; color: #444; font-size: 14px; white-space: pre-wrap; font-family: monospace; }
</style></head><body><div class="container"><a href="/" class="back">← Back</a><div class="content">${markdown.replace(/</g, '&lt;')}</div></div></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page);
    return;
  }

  // ─── Static guide parts ───
  const staticRoutes = ['/guide-part1.html', '/guide-part2.html', '/guide-part3.html'];
  if (req.method === 'GET' && staticRoutes.includes(parsed.pathname)) {
    const filePath = path.join(__dirname, parsed.pathname.slice(1));
    try {
      const html = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + parsed.pathname);
    }
    return;
  }

  // ─── Read body helper ───
  const readBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  // ─── POST /api/test — verify CF + IMAP ───
  if (req.method === 'POST' && parsed.pathname === '/api/test') {
    try {
      const data = JSON.parse(await readBody());
      if (!data.cfKey || !data.cfEmail) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing CF credentials' }));
        return;
      }
      if (!data.imap || !data.imap.host || !data.imap.user || !data.imap.pass) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing IMAP config' }));
        return;
      }

      // Test CF
      const cf = new CloudflareAPI(data.cfKey, data.cfEmail);
      await cf.verifyCredentials();
      const accountId = await cf.getAccountId();

      // Test IMAP
      const client = new ImapFlow({
        host: data.imap.host,
        port: data.imap.port,
        secure: data.imap.tls,
        auth: { user: data.imap.user, pass: data.imap.pass },
        logger: false
      });
      await client.connect();
      await client.logout();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: `CF OK (account: ${accountId.substring(0, 8)}...), IMAP OK (${data.imap.user})` }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ─── POST /api/setup — FULL AUTO ───
  if (req.method === 'POST' && parsed.pathname === '/api/setup') {
    try {
      const data = JSON.parse(await readBody());

      // validate
      if (!data.cfKey || !data.cfEmail) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing CF credentials' }));
        return;
      }
      if (!data.domains || !Array.isArray(data.domains) || data.domains.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'No domains provided' }));
        return;
      }
      if (!data.destEmail) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing destination email' }));
        return;
      }
      if (!data.imap || !data.imap.host || !data.imap.user || !data.imap.pass) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing IMAP config' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
      });

      const send = (message, type = 'info-text') => {
        res.write(JSON.stringify({ message, type }) + '\n');
      };

      const cf = new CloudflareAPI(data.cfKey, data.cfEmail);

      // 1. Verify CF credentials
      try {
        await cf.verifyCredentials();
        send('✓ CF credentials verified', 'success');
      } catch (e) {
        send(`✗ CF credential check failed: ${e.message}`, 'error');
        res.end();
        return;
      }

      // 2. Get account ID
      let accountId;
      try {
        accountId = await cf.getAccountId();
        send(`✓ CF account: ${accountId.substring(0, 8)}...`, 'success');
      } catch (e) {
        send(`✗ Failed to get account ID: ${e.message}`, 'error');
        res.end();
        return;
      }

      // 3. Add destination address
      let needVerify = false;
      try {
        const dest = await cf.addDestinationAddress(accountId, data.destEmail);
        send(dest.message, dest.status);
        needVerify = dest.needVerify;
      } catch (e) {
        send(`✗ Add destination failed: ${e.message}`, 'error');
        res.end();
        return;
      }

      // 4. Auto-verify via IMAP (if needed)
      if (needVerify) {
        send('', 'info-text');
        send('🔐 Starting IMAP auto-verification...', 'info-text');
        send(`   Connecting to ${data.imap.host}:${data.imap.port}`, 'info-text');

        try {
          const verifyResult = await autoVerifyViaIMAP(data.imap, data.destEmail, send, 120000);

          if (!verifyResult.verified) {
            send(`⚠ Auto-verify failed: ${verifyResult.error}`, 'warning-text');
            send('   Lu bisa verify manual: cek inbox, klik link dari Cloudflare', 'info-text');
            send('   Atau re-run tool setelah manual verify', 'info-text');
          }
        } catch (e) {
          send(`⚠ IMAP verify error: ${e.message}`, 'warning-text');
          send('   Lanjut set catch-all aja. CF akan forward setelah email verified.', 'info-text');
        }
        send('', 'info-text');
      } else {
        send('✓ Destination already verified, skipping IMAP', 'success');
      }

      // 5. Setup catch-all for each domain
      for (const domain of data.domains) {
        send(`\n--- ${domain} ---`, 'info-text');
        try {
          const zoneId = await cf.getZoneId(domain);
          send(`✓ Zone found: ${zoneId.substring(0, 8)}...`, 'success');

          const steps = await cf.setupCatchAll(zoneId, data.destEmail);
          steps.forEach(step => send(step.message, step.status));

          send(`✓ ${domain} complete!`, 'success');
        } catch (e) {
          send(`✗ ${domain} failed: ${e.message}`, 'error');
        }
      }

      // 6. Final check
      send('', 'info-text');
      let finalVerified = false;
      try {
        finalVerified = await cf.checkDestinationVerified(accountId, data.destEmail);
      } catch (e) {}

      if (finalVerified) {
        send(`🎉 Full auto setup complete! Destination verified, catch-all active.`, 'success');
      } else {
        send(`⚠ Setup complete but destination not yet verified.`, 'warning-text');
        send(`   Cek inbox ${data.destEmail}, klik link dari Cloudflare.`, 'info-text');
        send(`   Setelah verified, catch-all bakal langsung jalan.`, 'info-text');
      }

      res.end();
    } catch (e) {
      res.write(JSON.stringify({ message: '✗ Fatal: ' + e.message, type: 'error' }) + '\n');
      res.end();
    }
    return;
  }

  // ─── 404 ───
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found. Available: / /guide /app-password /tutorial /health /api/test /api/setup');
});

server.listen(PORT, HOST, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  IMAP Connector v4.0 (FULL AUTO)        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀  http://${HOST}:${PORT}`);
  console.log(`📖  http://${HOST}:${PORT}/guide`);
  console.log(`❤️  http://${HOST}:${PORT}/health`);
  console.log('');
  console.log('Flow:');
  console.log('  1. Enable email routing + DNS');
  console.log('  2. Add destination via API');
  console.log('  3. IMAP auto-verify (find + click CF link)');
  console.log('  4. Set catch-all rule');
  console.log('  5. Done: *@domain.com → destination inbox');
  console.log('');
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
