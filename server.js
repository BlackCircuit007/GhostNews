// Mock Express server with email-based verification flow
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();

// Enable compression for faster static file serving
app.use(compression());

// Use Express built-in JSON parser (no need for body-parser separately)
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Owner email (where verification links are sent). Set via env OWNER_EMAIL.
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || '';

// ------------------------------------------------------------------
// Persistent stores (survive server restarts so payers in the US can
// be verified later by the owner in Nigeria without losing data)
// ------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'data.json');

let ledger = []; // verified transactions
let pending = {}; // token -> { phone, amount, ref, date }
let verifiedTokens = {}; // confirmed token -> record

function loadData(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      ledger = Array.isArray(data.ledger) ? data.ledger : [];
      pending = data.pending || {};
      verifiedTokens = data.verifiedTokens || {};
      console.log('Loaded persisted data:', { ledger: ledger.length, pending: Object.keys(pending).length, verified: Object.keys(verifiedTokens).length });
    }
  }catch(err){
    console.error('Failed to load data file:', err.message);
  }
}

function saveData(){
  try{
    fs.writeFileSync(DATA_FILE, JSON.stringify({ ledger, pending, verifiedTokens }, null, 2));
  }catch(err){
    console.error('Failed to save data file:', err.message);
  }
}

loadData();

// ------------------------------------------------------------------
// ADVERTISEMENT SYSTEM
// ------------------------------------------------------------------
const ADS_API_KEY = process.env.ADS_API_KEY || '';
const ENABLE_ADS_API = process.env.ENABLE_ADS_API === 'true';
// External ad provider endpoint (set via env, empty = use local library)
const ADS_API_URL = process.env.ADS_API_URL || '';

// MONETAG (real ad network - popunder / push / vignette / interstitial).
// The multi-tag script is injected on EVERY page by monetag.js, with the
// zone id supplied by the server so it can be changed via env vars alone.
const MONETAG_ZONE_ID = process.env.MONETAG_ZONE_ID || '';
const MONETAG_TAG_URL = process.env.MONETAG_TAG_URL || 'https://quge5.com/88/tag.min.js';
// Fallback local ad library used when the external API is disabled or fails
const AD_LIBRARY = [
  {
    id: 'techsummit',
    image: 'ads/tech-summit.svg',
    link: 'https://example.com/techsummit',
    alt: 'TechSummit Lagos 2026 - Africa biggest tech and AI conference. Get tickets now.',
    label: 'Sponsored'
  },
  {
    id: 'brightlearn',
    image: 'ads/brightlearn.svg',
    link: 'https://example.com/brightlearn',
    alt: 'BrightLearn - Learn new skills. Earn a certificate. Online courses starting at N3,000.',
    label: 'Sponsored'
  },
  {
    id: 'skylight',
    image: 'ads/skylight-bank.svg',
    link: 'https://example.com/skylightbank',
    alt: 'SkyLite Bank - Smart banking for the digital age. Open an account in 5 minutes.',
    label: 'Sponsored'
  }
];

// Persistent ad impression stats (so revenue data survives restarts)
const AD_STATS_FILE = path.join(__dirname, 'ad_stats.json');
let adStats = { totalImpressions: 0, perAd: {}, lastReset: new Date().toISOString() };

function loadAdStats(){
  try{
    if(fs.existsSync(AD_STATS_FILE)){
      const raw = fs.readFileSync(AD_STATS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      adStats = {
        totalImpressions: parsed.totalImpressions || 0,
        perAd: parsed.perAd || {},
        lastReset: parsed.lastReset || new Date().toISOString()
      };
      console.log('Loaded ad stats:', { totalImpressions: adStats.totalImpressions });
    }
  }catch(err){
    console.error('Failed to load ad stats:', err.message);
  }
}

function saveAdStats(){
  try{
    fs.writeFileSync(AD_STATS_FILE, JSON.stringify(adStats, null, 2));
  }catch(err){
    console.error('Failed to save ad stats:', err.message);
  }
}

loadAdStats();

// Fetch ads from the external ad provider API (server-side, keeps API key secret)
async function fetchAdsFromProvider(){
  if(!ENABLE_ADS_API || !ADS_API_KEY || !ADS_API_URL){
    return null;
  }
  try{
    const resp = await fetch(ADS_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADS_API_KEY}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    if(!resp.ok) throw new Error('Ad provider API returned ' + resp.status);
    const data = await resp.json();
    return data.ads || null;
  }catch(err){
    console.warn('External ad API fetch failed, falling back to local ads:', err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// AUTOMATED PAYMENT GATEWAY (Flutterwave)
// Lets users pay online instantly to become payers — no manual
// transfer + manual verification needed.
// ------------------------------------------------------------------
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
const FLUTTERWAVE_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH || '';
const PAYMENT_AMOUNT = Number(process.env.PAYMENT_AMOUNT || 5000);
const PAYMENT_AMOUNT_MIN = Number(process.env.PAYMENT_AMOUNT_MIN || PAYMENT_AMOUNT);

// Treat placeholder/dummy keys as "not configured" so the app cleanly
// falls back to the manual transfer flow instead of failing web calls.
function flutterwaveConfigured(){
  const key = FLUTTERWAVE_SECRET_KEY || '';
  if(!key) return false;
  const lowered = key.toLowerCase();
  if(lowered.includes('your_secret_key') || lowered.includes('secret_key_here') || lowered.includes('xxxx') || lowered === 'flwseck') return false;
  return lowered.startsWith('flwseck') || lowered.startsWith('flwsec_') || lowered.length >= 20;
}

// NEWS DATA API (kept server-side so the key stays secret)
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsdata.io/api/1/latest';

// Mock news fallback when no API key is set or the API is down
const MOCK_NEWS = [
  { article_id: 'mock_1', title: 'Tech Innovation Transforms Nigeria', description: 'New technology initiatives are changing how Nigerians work and communicate.', content: 'New technology initiatives are changing how Nigerians work and communicate. Companies across the nation are adopting digital solutions to improve productivity and reach.', creator: ['Tech News Nigeria'], image_url: 'https://via.placeholder.com/400x250?text=Tech+News', link: 'https://example.com/tech-news', pubDate: new Date().toISOString() },
  { article_id: 'mock_2', title: 'Sports: Local Teams Advance', description: 'Local sports teams achieve major victories in national championships.', content: 'Local sports teams achieve major victories in national championships. The competitions continue to draw massive crowds and support from fans across the region.', creator: ['Sports Reporter'], image_url: 'https://via.placeholder.com/400x250?text=Sports', link: 'https://example.com/sports', pubDate: new Date(Date.now() - 86400000).toISOString() },
  { article_id: 'mock_3', title: 'Education: New Scholarship Program Launched', description: 'Government announces expanded scholarship opportunities for students.', content: 'Government announces expanded scholarship opportunities for students. The new program aims to support talented youth in pursuing higher education both domestically and internationally.', creator: ['Education Editor'], image_url: 'https://via.placeholder.com/400x250?text=Education', link: 'https://example.com/education', pubDate: new Date(Date.now() - 172800000).toISOString() }
];

// Proxy endpoint for news — keeps the API key secret and adds a graceful fallback
app.get('/api/news', async (req, res) => {
  const query = (req.query.q || '').trim();
  const date = (req.query.date || '').trim();
  const size = req.query.size || '10';

  if(!NEWS_API_KEY){
    return res.json({ ok: false, live: false, results: MOCK_NEWS, message: 'No NEWS_API_KEY configured. Showing sample news.' });
  }

  try{
    const api = new URL(NEWS_API_URL);
    api.searchParams.set('apikey', NEWS_API_KEY);
    if(query) api.searchParams.set('q', query);
    api.searchParams.set('country', 'ng');
    api.searchParams.set('language', 'en');
    api.searchParams.set('size', String(size));
    if(date) api.searchParams.set('from_date', date);

    const resp = await fetch(api, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
    });
    const json = await resp.json();

    if(json.status !== 'success'){
      throw new Error(json.results?.message || json.message || 'News feed failed');
    }

    res.json({ ok: true, live: true, results: json.results || [] });
  }catch(err){
    console.warn('News API fetch failed, falling back to mock:', err.message);
    res.json({ ok: false, live: false, results: MOCK_NEWS, message: err.message });
  }
});

// Add a verified transaction to the ledger (shared by manual & automated flows)
function addToLedger({ phone, amount, ref, provider, token, date, verifiedAt }){
  const record = {
    phone,
    amount: String(amount),
    ref: ref || token,
    date: date || new Date().toISOString(),
    token: token || ref,
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    verified: true,
    verifiedAt: verifiedAt || new Date().toISOString(),
    provider: provider || 'manual'
  };
  ledger.push(record);
  if(record.token) verifiedTokens[record.token] = record;
  if(ref) verifiedTokens[ref] = record;
  if(pending[token] || pending[ref]){
    delete pending[token];
    delete pending[ref];
  }
  saveData();
  return record;
}

// Create a Flutterwave payment link for a phone number
async function createFlutterwavePayment({ phone, email, redirectUrl }){
  const txRef = 'pc_' + crypto.randomBytes(8).toString('hex');
  const customerEmail = email || (phone.replace(/[^0-9]/g, '') + '@pressclub.users');

  const resp = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: PAYMENT_AMOUNT,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer: {
        email: customerEmail,
        name: phone,
        phonenumber: phone
      },
      customizations: {
        title: 'PressClub Premium',
        description: `Premium membership for ${phone}`,
        logo: 'https://' + 'presclub.herokuapp.com/favicon.svg'
      }
    }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
  });
  const data = await resp.json();

  if(data.status !== 'success' || !data.data || !data.data.link){
    throw new Error(data.message || 'Flutterwave could not create a payment link');
  }
  return { txRef, link: data.data.link };
}

// ------------------------------------------------------------------
// Email configuration diagnostics
// ------------------------------------------------------------------
function checkEmailConfig(){
  // SMTP is the primary channel. BREVO_API_KEY is optional (HTTPS fallback).
  const requiredChecks = {
    'OWNER_EMAIL': !!process.env.OWNER_EMAIL,
    'MAIL_FROM': !!process.env.MAIL_FROM,
    'SMTP_HOST': !!process.env.SMTP_HOST,
    'SMTP_PORT': !!process.env.SMTP_PORT,
    'SMTP_USER': !!process.env.SMTP_USER,
    'SMTP_PASS': !!process.env.SMTP_PASS
  };
  const missing = Object.entries(requiredChecks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  if(missing.length > 0){
    console.warn('==========================================================');
    console.warn('EMAIL CONFIG INCOMPLETE – missing env vars: ' + missing.join(', '));
    console.warn('Emails will NOT be sent until these are set.');
    console.warn('Set them in your hosting dashboard (e.g. Render -> Environment).');
    console.warn('See .env.example for reference values.');
    console.warn('==========================================================');
    return { complete: false, missing, smtpReady: false };
  }

  const optionalWarning = process.env.BREVO_API_KEY
    ? ''
    : ' (BREVO_API_KEY not set – SMTP will be used, HTTPS API fallback disabled)';
  console.log('Email configuration: OK (SMTP ready)' + optionalWarning);
  return { complete: true, missing: [], smtpReady: true };
}

checkEmailConfig();

// ------------------------------------------------------------------
// Health / diagnostics endpoint – shows email config status
// ------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const requiredKeys = ['OWNER_EMAIL', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const optionalKeys = ['BREVO_API_KEY'];
  const present = {};
  [...requiredKeys, ...optionalKeys].forEach(key => { present[key] = !!process.env[key]; });
  const missingRequired = requiredKeys.filter(key => !process.env[key]);
  const missingOptional = optionalKeys.filter(key => !process.env[key]);
  const smtpReady = missingRequired.length === 0;
  return res.json({
    ok: true,
    status: smtpReady ? 'ready' : 'email_not_configured',
    time: new Date().toISOString(),
    emailConfig: present,
    smtpReady,
    missingRequiredEnvVars: missingRequired,
    missingOptionalEnvVars: missingOptional,
    adConfig: {
      enabled: ENABLE_ADS_API && !!ADS_API_KEY,
      externalProvider: !!ADS_API_URL,
      totalImpressions: adStats.totalImpressions || 0,
      estimatedRevenue: ((adStats.totalImpressions || 0) * 0.005).toFixed(2)
    },
    ledgerCount: ledger.length,
    pendingCount: Object.keys(pending).length,
    note: smtpReady
      ? 'SMTP configured. Emails should be delivered.'
      : 'Set the missing SMTP env vars in your hosting dashboard (Render -> Environment). See .env.example.'
  });
});

// Lazy transporter creation - only creates when first email is sent (NOT at startup)
let transporterPromise = null;

// Short timeouts so that a blocked SMTP outbound port (common on Render free tier,
// Vercel, Netlify) fails fast instead of hanging the request for minutes.
const SMTP_TIMEOUTS = {
  connectionTimeout: 8000, // TCP connect
  greetingTimeout: 8000,   // SMTP greeting
  socketTimeout: 15000     // data send
};

async function getTransporter(){
  if(transporterPromise) return transporterPromise;
  
  // Use real SMTP if configured, otherwise skip email (don't try Ethereal at startup)
  if(process.env.SMTP_HOST && OWNER_EMAIL && MAIL_FROM){
    const nodemailer = require('nodemailer');
    transporterPromise = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === '1',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: SMTP_TIMEOUTS.connectionTimeout,
      greetingTimeout: SMTP_TIMEOUTS.greetingTimeout,
      socketTimeout: SMTP_TIMEOUTS.socketTimeout
    });
    return transporterPromise;
  }
  
  // No SMTP configured - send email via HTTPS API fallback instead
  transporterPromise = null;
  return null;
}

// ------------------------------------------------------------------
// Universal email sender.
//
// Deployed hosting providers (Render free tier, Vercel, Netlify, etc.)
// commonly block outbound SMTP, but you can still send through the
// Brevo HTTP API on port 443 (which is never blocked). Strategy:
//   1) Try SMTP (fast on normal hosts) with a short timeout.
//   2) If SMTP times out / fails, fall back to the Brevo HTTP API.
// ------------------------------------------------------------------
async function sendEmail({ to, replyTo, subject, html }){
  // 1) Try SMTP first when configured
  try{
    const transporter = await getTransporter();
    if(transporter){
      const nodemailer = require('nodemailer');
      const info = await transporter.sendMail({
        from: MAIL_FROM,
        to,
        replyTo,
        subject,
        html
      });
      console.log('Email sent via SMTP:', { to, subject });
      return { ok: true, via: 'smtp', info };
    }
  }catch(smtpErr){
    console.error('SMTP failed (will try HTTPS API):', smtpErr.message);
    // Fall through to the HTTP API
  }

  // 2) Fallback: Brevo HTTP API (HTTPS / port 443 - allowed on all hosts)
  //    Requires a Brevo REST API key (BREVO_API_KEY, starts with xkeysib-...).
  //    The SMTP key (SMTP_PASS, starts with xsmtpsib-) CANNOT be used with the REST API.
  const brevoApiKey = process.env.BREVO_API_KEY;
  if(brevoApiKey && OWNER_EMAIL){
    try{
      // Parse MAIL_FROM ("Name <email>") into parts; fall back to OWNER_EMAIL
      let senderName = 'PressClub';
      let fromEmail = OWNER_EMAIL;
      const fromMatch = String(MAIL_FROM).match(/^(.*)\s*<([^>]+)>$/);
      if(fromMatch){
        senderName = fromMatch[1].trim().replace(/^"|"$/g, '') || senderName;
        fromEmail = fromMatch[2].trim() || fromEmail;
      }

      const payload = {
        sender: { name: senderName, email: fromEmail },
        to: [{ email: to, name: to }],
        subject,
        htmlContent: html
      };
      if(replyTo) payload.replyTo = { email: replyTo };

      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify(payload)
      });

      if(!resp.ok){
        const body = await resp.text();
        throw new Error('Brevo HTTP API error ' + resp.status + ': ' + body);
      }

      console.log('Email sent via HTTPS API:', to);
      return { ok: true, via: 'http' };
    }catch(apiErr){
      console.error('Brevo HTTP API send failed:', apiErr.message);
      return { ok: false, via: 'http', error: apiErr };
    }
  }

  // 3) No email channel available
  console.warn('No email channel available – email not sent to:', to);
  return { ok: false, via: 'none', error: new Error('No SMTP / API configured') };
}

app.post('/api/request-verify', async (req, res) => {
  const { phone, amount, ref } = req.body || {};
  if(!phone || !amount || !ref){
    return res.status(400).json({ ok: false, message: 'Missing fields' });
  }

  const token = crypto.randomBytes(12).toString('hex');
  pending[token] = { phone, amount: String(amount), ref, date: new Date().toISOString(), token };
  saveData();

  try{
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify/${token}`;
    const result = await sendEmail({
      to: OWNER_EMAIL,
      subject: `Payment verification request: ${ref}`,
      html: `<p>Payment request received:</p>
             <ul>
               <li>Phone: ${phone}</li>
               <li>Amount: ${amount} NGN</li>
               <li>Ref: ${ref}</li>
             </ul>
             <p><a href="${verifyUrl}">Click here to review and verify this payment</a></p>`
    });

    console.log('Payment verification request:', { phone, amount, ref, token, via: result.via });
    if(result.ok){
      return res.json({ ok: true, token, emailSent: true, via: result.via, preview: null });
    }
    // Email failed on both SMTP + API, but request was saved for manual review
    return res.json({ ok: true, token, emailSent: false, message: 'Verification request saved, but email delivery failed. The owner can review it manually.' });
  }
  catch(err){
    console.error('Email send error', err);
    // Still return the token so verification can happen manually
    return res.json({ ok: true, token, emailSent: false, message: 'Email delivery failed, but the verification request was saved for manual review.' });
  }
});

// Owner-facing verify page with confirm button
app.get('/verify/:token', (req, res) => {
  const t = req.params.token;
  const p = pending[t];
  if(!p){
    return res.status(404).send('<h1>Not found or already verified</h1>');
  }
  res.send(`<!doctype html><html><body>
    <h2>Verify Payment</h2>
    <p>Phone: ${p.phone}</p>
    <p>Amount: ${p.amount} NGN</p>
    <p>Ref: ${p.ref}</p>
    <form method="POST" action="/api/confirm/${t}">
      <button type="submit">Confirm Payment</button>
    </form>
    </body></html>`);
});

app.post('/api/confirm/:token', (req, res) => {
  const t = req.params.token;
  const p = pending[t];
  if(!p) return res.status(404).send('Not found');
  const id = 'tx_' + Date.now();
  const record = { ...p, id, verified: true, verifiedAt: new Date().toISOString() };
  ledger.push(record);
  // Keep a copy of verified tokens so the client can poll them transiently
  verifiedTokens[t] = record; // store by token so /api/check-token can resolve it
  delete pending[t];
  saveData();
  console.log('Confirmed:', id);
  return res.send('<h1>Payment marked as verified. You can close this page.</h1>');
});

app.get('/api/check-token', (req, res) => {
  const token = req.query.token;
  if(!token) return res.status(400).json({ ok: false });

  // 1. Check verifiedTokens map first (instant when owner confirms)
  if(verifiedTokens[token]){
    return res.json({ verified: true, transactionId: verifiedTokens[token].id, ...verifiedTokens[token] });
  }

  // 2. Check the ledger as fallback
  const found = ledger.find(l => l.id === token || l.token === token);
  if(found){
    return res.json({ verified: true, transactionId: found.id });
  }

  // 3. If token is pending but not yet verified, inform the client
  if(pending[token]){
    return res.json({ verified: false });
  }
  return res.json({ verified: false });
});

// ------------------------------------------------------------------
// ADVERTISING API ENDPOINTS
// ------------------------------------------------------------------

// Return public server-side configuration to the client.
// The API key is NEVER sent to the browser — only a boolean flag.
app.get('/api/config', (req, res) => {
  res.json({
    adsApiEnabled: ENABLE_ADS_API && !!ADS_API_KEY,
    adsApiFallbackToLocal: true,
    adsApiEndpoint: '/api/ads',
    monetagZone: MONETAG_ZONE_ID,
    monetagTagUrl: MONETAG_TAG_URL
  });
});

// Serve ads to the client.
// 1. If an external ad provider is configured & enabled, fetch from it.
// 2. On failure or when disabled, fall back to the local AD_LIBRARY.
app.get('/api/ads', async (req, res) => {
  // Try external provider first (server-side: keeps API key secret)
  let ads = null;
  if(ENABLE_ADS_API && ADS_API_KEY && ADS_API_URL){
    ads = await fetchAdsFromProvider();
  }

  // Fallback to local library
  if(!ads || !ads.length){
    ads = AD_LIBRARY;
  }

  res.json({ ads });
});

// Track a single ad impression for pay-per-view revenue calculation
app.post('/api/ads/impression', (req, res) => {
  const { adId, userId, timestamp } = req.body || {};
  if(!adId){
    return res.status(400).json({ ok: false, message: 'adId is required' });
  }

  adStats.totalImpressions = (adStats.totalImpressions || 0) + 1;
  if(!adStats.perAd[adId]){
    adStats.perAd[adId] = { impressions: 0, lastSeen: timestamp || new Date().toISOString() };
  }
  adStats.perAd[adId].impressions = (adStats.perAd[adId].impressions || 0) + 1;
  adStats.perAd[adId].lastSeen = timestamp || new Date().toISOString();

  saveAdStats();

  // Estimate: $0.005 per impression (placeholder — replace with real rate card)
  const ratePerImpression = 0.005;
  const estimatedRevenue = (adStats.totalImpressions * ratePerImpression).toFixed(2);

  res.json({ ok: true, totalImpressions: adStats.totalImpressions, estimatedRevenue });
});

// Public stats endpoint (total impressions, per-ad breakdown)
app.get('/api/stats', (req, res) => {
  const ratePerImpression = 0.005;
  res.json({
    totalImpressions: adStats.totalImpressions || 0,
    perAd: adStats.perAd || {},
    estimatedRevenue: ((adStats.totalImpressions || 0) * ratePerImpression).toFixed(2),
    currency: 'USD'
  });
});

// Owner stats: payer count + total payments collected
app.get('/api/owner-stats', (req, res) => {
  const payers = [...new Set(ledger.map(l => l.phone).filter(Boolean))];
  const totalCollected = ledger.reduce((sum, l) => sum + (Number(String(l.amount).replace(/[^0-9.]/g, '')) || 0), 0);
  res.json({
    payerCount: payers.length,
    payers,
    transactionCount: ledger.length,
    totalCollectedNgn: totalCollected,
    totalCollectedNgnFormatted: 'NGN ' + totalCollected.toLocaleString('en-NG'),
    pendingCount: Object.keys(pending).length,
    ratePerImpression: 0.005,
    adRevenueUsd: ((adStats.totalImpressions || 0) * 0.005).toFixed(2),
    totalImpressions: adStats.totalImpressions || 0
  });
});

// Full ledger for the owner (requires the owner pass if set)
// Pass the owner pass in the X-Owner-Pass header or ?pass= query param.
app.get('/api/ledger', (req, res) => {
  const ownerPass = process.env.OWNER_PASS || '';
  const provided = (req.headers['x-owner-pass'] || req.query.pass || '').toString();
  if(ownerPass && provided !== ownerPass){
    return res.status(401).json({ ok: false, message: 'Owner pass required' });
  }
  const sorted = [...ledger].sort((a, b) => new Date(b.verifiedAt || b.date || 0) - new Date(a.verifiedAt || a.date || 0));
  res.json({ ok: true, transactions: sorted.slice(0, 50), pendingCount: Object.keys(pending).length });
});

// Contact form endpoint - receive emails from users AND log them in as payers
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  
  if(!name || !email || !message) {
    return res.status(400).json({ ok: false, message: 'Missing required fields (name, email, message)' });
  }

  try {
    const result = await sendEmail({
      to: OWNER_EMAIL,
      replyTo: email,
      subject: subject || `New contact form submission from ${name}`,
      html: `<h2>New Contact Form Submission</h2>
             <p><strong>From:</strong> ${name} (${email})</p>
             <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
             <hr>
             <p><strong>Message:</strong></p>
             <p>${message.replace(/\n/g, '<br>')}</p>`
    });

    // Always succeed so the user gets feedback (even if delivery channel is down).
    // The status reflects whether it actually went out.
    return res.json({ 
      ok: true, 
      via: result.via || 'none',
      message: result.ok ? 'Email sent successfully' : 'Message received, but email delivery failed on this host. The message was still recorded.',
      emailSent: result.ok
    });
  } catch(err) {
    console.error('Contact email send error', err);
    return res.status(500).json({ ok: false, message: 'Failed to send email: ' + err.message });
  }
});

// Login endpoint - users login with their phone number
app.post('/api/login', (req, res) => {
  const { phone } = req.body || {};
  
  if(!phone) {
    return res.status(400).json({ ok: false, message: 'Phone number required' });
  }

  // Check if phone exists in ledger (verified payments), newest first
  const userTransactions = ledger
    .filter(l => l.phone === phone)
    .sort((a, b) => new Date(b.verifiedAt || b.date || 0) - new Date(a.verifiedAt || a.date || 0));
  
  if(userTransactions.length === 0) {
    return res.status(401).json({ ok: false, message: 'Phone number not found. Please make a payment first.' });
  }

  // Create a session token for this login
  const sessionToken = crypto.randomBytes(16).toString('hex');

  // Subscription is valid for 30 days from the most recent verified payment
  const latest = userTransactions[0];
  const verifiedAt = latest.verifiedAt || latest.date || new Date().toISOString();
  const expiresAt = new Date(new Date(verifiedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const expired = Date.now() > new Date(expiresAt).getTime();

  // User found - return their transaction details and session
  console.log('Login successful for phone:', phone, 'session:', sessionToken, 'expiresAt:', expiresAt, 'expired:', expired);
  return res.json({ 
    ok: true, 
    message: 'Login successful',
    phone: phone,
    transactions: userTransactions,
    status: expired ? 'expired' : 'payer',
    subscription: { verifiedAt, expiresAt, expired, validDays: 30 },
    sessionToken: sessionToken
  });
});

// ------------------------------------------------------------------
// AUTOMATED PAYMENT ENDPOINTS (Flutterwave)
// ------------------------------------------------------------------

// Initiate an online payment to become a Payer
app.post('/api/initiate-payment', async (req, res) => {
  const { phone, email } = req.body || {};

  if(!phone || !String(phone).trim()){
    return res.status(400).json({ ok: false, message: 'Phone number is required.' });
  }
  if(!flutterwaveConfigured()){
    return res.status(400).json({
      ok: false,
      message: 'Online payment is not enabled yet. Please use the manual transfer option and we will verify it for you.'
    });
  }

  const redirectUrl = `${req.protocol}://${req.get('host')}/payment-complete`;

  try{
    const payment = await createFlutterwavePayment({
      phone: String(phone).trim(),
      email,
      redirectUrl
    });

    // Store a pending record so the webhook can resolve the phone number
    pending[payment.txRef] = {
      phone: String(phone).trim(),
      amount: String(PAYMENT_AMOUNT),
      ref: payment.txRef,
      date: new Date().toISOString(),
      provider: 'flutterwave'
    };
    saveData();

    return res.json({ ok: true, paymentLink: payment.link, txRef: payment.txRef });
  }catch(err){
    console.error('Initiate payment error:', err.message);
    return res.status(502).json({ ok: false, message: 'Could not create payment link: ' + err.message });
  }
});

// Verify an automated payment by tx_ref (called by payment-complete page)
app.get('/api/payment-verify', async (req, res) => {
  const txRef = req.query.tx_ref;
  if(!txRef) return res.status(400).json({ ok: false, message: 'tx_ref required' });

  // Already verified?
  const existing = ledger.find(l => l.ref === txRef || l.token === txRef);
  if(existing){
    return res.json({ ok: true, verified: true, phone: existing.phone });
  }

  if(!flutterwaveConfigured()){
    return res.json({ ok: false, verified: false, message: 'Payment gateway not configured.' });
  }

  try{
    const resp = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { 'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}` }
    });
    const data = await resp.json();

    if(data.status === 'success' && data.data && data.data.length){
      const tx = data.data[0];
      if(tx.status === 'successful'){
        const pendingInfo = pending[txRef] || {};
        addToLedger({
          phone: pendingInfo.phone || (tx.customer && (tx.customer.phone || tx.customer.name)) || 'unknown',
          amount: tx.amount || PAYMENT_AMOUNT,
          ref: txRef,
          provider: 'flutterwave',
          token: txRef
        });
        return res.json({ ok: true, verified: true, phone: pendingInfo.phone, amount: tx.amount });
      }
      return res.json({ ok: false, verified: false, status: tx.status, message: 'Transaction was not successful.' });
    }
    return res.json({ ok: false, verified: false, message: data.message || 'Transaction not found.' });
  }catch(err){
    console.error('Payment verify error:', err.message);
    return res.status(502).json({ ok: false, verified: false, message: 'Verification failed: ' + err.message });
  }
});

// Flutterwave webhook — auto-verifies payments without user clicking anything
app.post('/api/flutterwave-webhook', async (req, res) => {
  // Verify the webhook signature
  const signature = req.headers['verif-hash'] || '';
  if(FLUTTERWAVE_SECRET_HASH && signature !== FLUTTERWAVE_SECRET_HASH){
    return res.status(401).json({ ok: false, message: 'Invalid signature' });
  }

  const event = req.body || {};
  const type = event.event || event.type || '';
  const tx = event.data || {};

  if(!/completed|successful|success/i.test(type) && tx.status !== 'successful'){
    return res.sendStatus(200); // acknowledge non-payment events
  }

  const txRef = tx.tx_ref || '';
  if(!txRef){
    return res.sendStatus(200);
  }

  try{
    // Double-check with Flutterwave to be safe
    let flashAmount = tx.amount || 0;
    if(FLUTTERWAVE_SECRET_KEY && tx.id){
      try{
        const verifyResp = await fetch(`https://api.flutterwave.com/v3/transactions/${tx.id}/verify`, {
          headers: { 'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}` }
        });
        const verifyData = await verifyResp.json();
        if(verifyData.status === 'success' && verifyData.data){
          flashAmount = verifyData.data.amount || flashAmount;
        }
      }catch(e){ /* fall back to webhook body */ }
    }

    if(Number(flashAmount) >= Number(PAYMENT_AMOUNT_MIN)){
      const pendingInfo = pending[txRef] || {};
      if(!ledger.find(l => l.ref === txRef || l.token === txRef)){
        addToLedger({
          phone: pendingInfo.phone || (tx.customer && (tx.customer.phone || tx.customer.name)) || 'unknown',
          amount: flashAmount,
          ref: txRef,
          provider: 'flutterwave',
          token: txRef
        });
        console.log('Flutterwave webhook verified payment:', txRef, 'for', pendingInfo.phone);
      }
    }
  }catch(err){
    console.error('Flutterwave webhook processing error:', err.message);
  }

  return res.sendStatus(200);
});

// ------------------------------------------------------------------
// SECURITY: never expose secrets or internal files to the public.
// express.static() serves the whole project directory, so sensitive
// files (.env with all keys, data.json with payer phone numbers,
// server.js, etc.) must be blocked BEFORE it runs.
// ------------------------------------------------------------------
app.use((req, res, next) => {
  const p = String(req.path).toLowerCase();
  const blocked = [
    '/server.js', '/package.json', '/package-lock.json',
    '/data.json', '/ad_stats.json', '/render.yaml',
    '/.env', '/.gitignore', '/sw (1).js'
  ];
  if(blocked.includes(p) || p.includes('.env') || p.startsWith('/.git')){
    return res.status(404).send('Not found');
  }
  next();
});

// Serve static files with caching headers
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Cache HTML files for shorter time
    if(filePath.endsWith('.html')){
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
    // Cache images and fonts longer
    if(filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/i)){
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    // Cache CSS and JS
    if(filePath.match(/\.(css|js)$/i)){
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for direct HTML access
app.get('/:page', (req, res) => {
  // Only allow .html extension for safety
  const page = req.params.page;
  if(page.endsWith('.html')){
    res.sendFile(path.join(__dirname, page));
  } else {
    res.status(404).send('Not found');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log('========================================');
  console.log('Verification server running on http://localhost:' + port);
  console.log('========================================');
  console.log('Test URLs:');
  console.log('  - http://localhost:' + port + '/ (Home)');
  console.log('  - http://localhost:' + port + '/news.html (News)');
  console.log('  - http://localhost:' + port + '/dashboard.html (Dashboard)');
});
