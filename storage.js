// ==================================================================
// PRESSCLUB STORAGE LAYER
// Two backends, same interface:
//   1. CockroachDB / PostgreSQL  — used when DATABASE_URL is set
//   2. JSON files                — data.json + ad_stats.json are
//                                  ALWAYS mirrored as a local backup
//                                  so local dev & free hosts work.
//
// Usage in server.js:
//   const store = require('./storage');
//   store.init();                 // async: loads persisted state
//   store.data.ledger.push(...);  // mutate freely
//   store.save();                 // debounced persist (DB + files)
// ==================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const AD_STATS_FILE = path.join(__dirname, 'ad_stats.json');

// Single source of truth for the whole server
const data = {
  ledger: [],          // verified payment transactions
  pending: {},         // token -> payment awaiting verification
  verifiedTokens: {},  // confirmed token -> record (for client polling)
  adStats: { totalImpressions: 0, perAd: {}, lastReset: new Date().toISOString() }
};

let pool = null;        // pg Pool (CockroachDB mode)
let dbEnabled = false;  // true when CockroachDB is connected & loaded
let initInfo = { backend: 'file' };
let saveTimer = null;
let saveDirty = false;

// ------------------------------------------------------------------
// JSON file backend (backup + local dev)
// ------------------------------------------------------------------
function readJsonNoBom(file){
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
}

function loadDataFromFiles(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const parsed = readJsonNoBom(DATA_FILE);
      if(Array.isArray(parsed.ledger)) data.ledger = parsed.ledger;
      if(parsed.pending && typeof parsed.pending === 'object') data.pending = parsed.pending;
      if(parsed.verifiedTokens && typeof parsed.verifiedTokens === 'object') data.verifiedTokens = parsed.verifiedTokens;
      console.log('Loaded file backup:', { ledger: data.ledger.length, pending: Object.keys(data.pending).length });
    }
  }catch(err){ console.error('Failed to load data.json:', err.message); }
  try{
    if(fs.existsSync(AD_STATS_FILE)){
      const parsed = readJsonNoBom(AD_STATS_FILE);
      if(parsed && typeof parsed === 'object'){
        data.adStats = {
          totalImpressions: parsed.totalImpressions || 0,
          perAd: parsed.perAd || {},
          lastReset: parsed.lastReset || new Date().toISOString()
        };
      }
    }
  }catch(err){ console.error('Failed to load ad_stats.json:', err.message); }
}

function saveDataToFiles(){
  try{ fs.writeFileSync(DATA_FILE, JSON.stringify({ ledger: data.ledger, pending: data.pending, verifiedTokens: data.verifiedTokens }, null, 2)); }
  catch(err){ console.error('Failed to save data.json:', err.message); }
  try{ fs.writeFileSync(AD_STATS_FILE, JSON.stringify(data.adStats, null, 2)); }
  catch(err){ console.error('Failed to save ad_stats.json:', err.message); }
}

// ------------------------------------------------------------------
// CockroachDB backend
// ------------------------------------------------------------------
// CockroachDB Cloud requires TLS. Map the sslmode in DATABASE_URL to
// the options node-postgres understands.
function sslForUrl(url){
  const m = /sslmode=([a-z-]+)/i.exec(url);
  const mode = (m ? m[1] : 'require').toLowerCase();
  if(mode === 'disable') return false;
  if(mode === 'verify-full' || mode === 'verify-ca'){
    const ssl = { rejectUnauthorized: true };
    const caPath = process.env.PGSSLROOTCERT || '';
    if(caPath){
      try{ ssl.ca = fs.readFileSync(caPath, 'utf8'); }
      catch(err){ console.warn('PGSSLROOTCERT unreadable, using Node trust store:', err.message); }
    }
    return ssl;
  }
  // require / prefer — encrypted connection, standard public CA check relaxed
  return { rejectUnauthorized: false };
}

// DB is authoritative; file-only rows are preserved so nothing is lost
// (e.g. payments taken while the DB was unreachable).
function mergeDbState(db){
  const seen = new Set();
  const mergedLedger = [];
  for(const row of (db.ledger || [])){
    const key = row.id || row.ref || row.token || JSON.stringify(row).slice(0, 64);
    if(!seen.has(key)){ seen.add(key); mergedLedger.push(row); }
  }
  for(const row of (data.ledger || [])){
    const key = row.id || row.ref || row.token || JSON.stringify(row).slice(0, 64);
    if(!seen.has(key)){ seen.add(key); mergedLedger.push(row); }
  }
  data.ledger = mergedLedger;
  data.pending = Object.assign({}, data.pending, db.pending || {});
  data.verifiedTokens = Object.assign({}, data.verifiedTokens, db.verifiedTokens || {});
  const dbStats = db.adStats || {};
  data.adStats = {
    totalImpressions: Math.max(data.adStats.totalImpressions || 0, dbStats.totalImpressions || 0),
    perAd: Object.assign({}, data.adStats.perAd),
    lastReset: dbStats.lastReset || data.adStats.lastReset
  };
  for(const id of Object.keys(dbStats.perAd || {})){
    const s = dbStats.perAd[id] || {};
    const cur = data.adStats.perAd[id] || { impressions: 0, lastSeen: '' };
    data.adStats.perAd[id] = {
      impressions: Math.max(cur.impressions || 0, s.impressions || 0),
      lastSeen: (s.lastSeen || '') > (cur.lastSeen || '') ? s.lastSeen : cur.lastSeen
    };
  }
}

async function connectDb(){
  const url = process.env.DATABASE_URL || '';
  if(!url) return;
  try{
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      ssl: sslForUrl(url),
      max: 5,
      connectionTimeoutMillis: 10000,
      application_name: 'pressclub'
    });
    await pool.query(
      'CREATE TABLE IF NOT EXISTS pressclub_state (' +
      ' k TEXT PRIMARY KEY,' +
      ' v JSONB NOT NULL,' +
      ' updated_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const res = await pool.query('SELECT k, v FROM pressclub_state');
    const db = {};
    for(const row of res.rows){ db[row.k] = row.v; }
    mergeDbState(db);
    dbEnabled = true;
    initInfo = { backend: 'cockroachdb' };
    console.log('CockroachDB connected — payments & ad stats are database-backed:',
      { ledger: data.ledger.length, pending: Object.keys(data.pending).length,
        verified: Object.keys(data.verifiedTokens).length, impressions: data.adStats.totalImpressions });
  }catch(err){
    initInfo = { backend: 'file', error: err.message };
    console.warn('DATABASE_URL is set but CockroachDB is unreachable — falling back to JSON files.');
    console.warn('DB error:', err.message);
    if(pool){ try{ await pool.end(); }catch(e){ /* ignore */ } pool = null; }
  }
}

async function saveDataToDb(){
  if(!dbEnabled || !pool) return;
  const sql = 'INSERT INTO pressclub_state (k, v, updated_at) VALUES ($1, $2::jsonb, now())' +
              ' ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()';
  await pool.query(sql, ['ledger', JSON.stringify(data.ledger)]);
  await pool.query(sql, ['pending', JSON.stringify(data.pending)]);
  await pool.query(sql, ['verifiedTokens', JSON.stringify(data.verifiedTokens)]);
  await pool.query(sql, ['adStats', JSON.stringify(data.adStats)]);
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
function flush(){
  if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
  saveDataToFiles(); // files always (backup + local dev)
  if(dbEnabled && pool){
    saveDataToDb().catch(err => {
      console.warn('CockroachDB save failed (kept in memory + files):', err.message);
    });
  }
}

// Debounced save — safe to call after every mutation
function save(){
  saveDirty = true;
  if(saveTimer) return;
  saveTimer = setTimeout(function(){
    saveTimer = null;
    saveDirty = false;
    flush();
  }, 1500);
}

async function init(){
  loadDataFromFiles();
  await connectDb();
  return initInfo;
}

// Make sure pending writes hit the files even on shutdown
process.on('exit', function(){ if(saveDirty || saveTimer) saveDataToFiles(); });
for(const sig of ['SIGINT', 'SIGTERM']){
  process.on(sig, function(){
    saveDataToFiles();
    if(pool){ pool.end().catch(function(){}); }
    process.exit(0);
  });
}

module.exports = { data, init, save, flush, initInfo: () => initInfo };
