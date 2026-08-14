// Mock Express server with email-based verification flow
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Owner email (where verification links are sent). Set via env OWNER_EMAIL.
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@example.com';

// ------------------------------------------------------------------
// Persistent stores (survive server restarts so payers in the US can
// be verified later by the owner in Nigeria without losing data)
// ------------------------------------------------------------------
const fs = require('fs');
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

async function createTransporter(){
  if(process.env.SMTP_HOST){
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === '1',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }
  // fallback to Ethereal for demo
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
}

let transporterPromise = createTransporter();

app.post('/api/request-verify', async (req, res) => {
  const { phone, amount, ref } = req.body || {};
  if(!phone || !amount || !ref){
    return res.status(400).json({ ok: false, message: 'Missing fields' });
  }

  const token = crypto.randomBytes(12).toString('hex');
  pending[token] = { phone, amount: String(amount), ref, date: new Date().toISOString(), token };
  saveData();

  const verifyUrl = `${req.protocol}://${req.get('host')}/verify/${token}`;

  try{
    const transporter = await transporterPromise;
    const info = await transporter.sendMail({
      from: 'no-reply@pressclub.example',
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

    const preview = nodemailer.getTestMessageUrl(info) || null;
    console.log('Payment verification request:', { phone, amount, ref, token, preview: !!preview });
    return res.json({ ok: true, token, preview });
  }
  catch(err){
    console.error('Email send error', err);
    return res.status(500).json({ ok: false, message: 'Email send failed: ' + err.message });
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

// Contact form endpoint - receive emails from users AND log them in as payers
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  
  if(!name || !email || !message) {
    return res.status(400).json({ ok: false, message: 'Missing required fields (name, email, message)' });
  }

  try {
    const transporter = await transporterPromise;
    
    // Send email to owner
    const info = await transporter.sendMail({
      from: email,
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

    console.log('Contact email sent:', { name, email, subject, preview: !!nodemailer.getTestMessageUrl(info) });
    
    // Create a payer account for this user
    const payerId = 'user_' + crypto.randomBytes(6).toString('hex');
    const transaction = {
      id: payerId,
      phone: email,
      amount: 'Contact Form',
      ref: name,
      date: new Date().toISOString(),
      email: email
    };
    ledger.push(transaction);
    saveData();
    
    console.log('Payer account created:', payerId, 'for', email);
    
    return res.json({ 
      ok: true, 
      message: 'Email sent successfully',
      payerId: payerId,
      transactionId: payerId,
      isNowPayer: true
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

  // Check if phone exists in ledger (verified payments)
  const userTransactions = ledger.filter(l => l.phone === phone);
  
  if(userTransactions.length === 0) {
    return res.status(401).json({ ok: false, message: 'Phone number not found. Please make a payment first.' });
  }

  // Create a session token for this login
  const sessionToken = crypto.randomBytes(16).toString('hex');

  // User found - return their transaction details and session
  console.log('Login successful for phone:', phone, 'session:', sessionToken);
  return res.json({ 
    ok: true, 
    message: 'Login successful',
    phone: phone,
    transactions: userTransactions,
    status: 'payer',
    sessionToken: sessionToken
  });
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for direct HTML access
app.get('/:page.html', (req, res) => {
  res.sendFile(path.join(__dirname, req.params.page + '.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('========================================');
  console.log('Verification server running on http://localhost:' + port);
  console.log('========================================');
  console.log('Test URLs:');
  console.log('  - http://localhost:' + port + '/ (Home)');
  console.log('  - http://localhost:' + port + '/news.html (News)');
  console.log('  - http://localhost:' + port + '/dashboard.html (Dashboard)');
});
