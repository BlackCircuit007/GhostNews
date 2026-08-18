function isPayer(){ return localStorage.getItem('pressclub_isPayer') === '1'; }
function getLoggedInPhone(){ return localStorage.getItem('pressclub_phone') || ''; }

// Per-user storage keys
function getTxsKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_txs_${phone}` : 'pressclub_txs'; }
function getPinnedKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_pinned_articles_${phone}` : 'pressclub_pinned_articles'; }
function getAdfreeKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_adfree_${phone}` : 'pressclub_adfree'; }
function getCompactKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_compact_${phone}` : 'pressclub_compact'; }
function getNotifyKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_notify_${phone}` : 'pressclub_notify'; }
function getSubKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_sub_${phone}` : 'pressclub_sub'; }
function getStatsKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_stats_${phone}` : 'pressclub_stats'; }
function getHistoryKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_history_${phone}` : 'pressclub_history'; }
function getReadingKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_reading_${phone}` : 'pressclub_reading'; }

function getPinnedArticles(){ try { return JSON.parse(localStorage.getItem(getPinnedKey()) || '[]'); } catch { return []; } }
function getTransactions(){ try { return JSON.parse(localStorage.getItem(getTxsKey()) || '[]'); } catch { return []; } }
function getStats(){ try { return JSON.parse(localStorage.getItem(getStatsKey()) || 'null'); } catch { return null; } }
function getHistory(){ try { return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]'); } catch { return []; } }
function getReadingList(){ try { return JSON.parse(localStorage.getItem(getReadingKey()) || '[]'); } catch { return []; } }
function getSubscription(){ try { return JSON.parse(localStorage.getItem(getSubKey()) || 'null'); } catch { return null; } }
function paymentValue(value){ return Number(String(value || '').replace(/[^0-9.]/g, '')) || 0; }
function formatNaira(value){ return 'NGN ' + new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value); }

function todayStr(){ return new Date().toISOString().split('T')[0]; }

// Compute reading streak from stored daily-read dates
function computeStreak(readDates){
  if(!readDates || !readDates.length) return 0;
  const dates = [...new Set(readDates)].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  const today = todayStr();
  // If user hasn't read today yet, allow streak to start from yesterday
  if(!dates.includes(today)){
    cursor.setDate(cursor.getDate() - 1);
  }
  let cursorStr = cursor.toISOString().split('T')[0];
  for(let i = 0; i < dates.length; i++){
    if(dates[i] === cursorStr){
      streak++;
      const d = new Date(cursorStr);
      d.setDate(d.getDate() - 1);
      cursorStr = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
}

function renderPins(){
  const pins = getPinnedArticles();
  document.getElementById('pinnedCount').textContent = pins.length;
  document.getElementById('clearPinsBtn').hidden = pins.length === 0;
  document.getElementById('pinnedArticles').innerHTML = pins.length ? pins.map(article => `<article class="pinned-card"><div><span class="pinned-card__meta">${article.date || 'Recently saved'} | ${article.author || 'PressClub'}</span><h4>${article.title}</h4><p>${article.summary || ''}</p></div><div class="article-actions"><a class="btn primary" href="news.html?article=${encodeURIComponent(article.id)}">Read article</a><button class="btn secondary unpin-btn" data-id="${article.id}" type="button">Remove</button></div></article>`).join('') : '<div class="empty-state"><strong>No saved articles yet.</strong><span>Open an article in News and choose Save to dashboard.</span><a class="btn secondary" href="news.html">Explore news</a></div>';
}

function bindPinControls(){
  document.getElementById('pinnedArticles').onclick = event => {
    const button = event.target.closest('.unpin-btn');
    if(!button) return;
    localStorage.setItem(getPinnedKey(), JSON.stringify(getPinnedArticles().filter(article => article.id !== button.dataset.id)));
    renderPins();
  };
  document.getElementById('clearPinsBtn').onclick = () => { localStorage.removeItem(getPinnedKey()); renderPins(); };
}

// ------------------------------------------------------------------
// Render premium stats section
// ------------------------------------------------------------------
function renderPremiumStats(){
  const stats = getStats();
  const history = getHistory();

  // Streak
  const readDates = stats?.readDates || history.map(h => h.date).filter(Boolean);
  const streak = computeStreak(readDates);
  document.getElementById('streakValue').textContent = streak === 0 ? 'Start today!' : `${streak} day${streak === 1 ? '' : 's'} 🔥`;

  // Articles read
  const uniqueRead = new Set((history || []).map(h => h.id)).size;
  document.getElementById('articlesReadCount').textContent = uniqueRead;

  // Reading minutes (approx 2 min per article)
  const minutes = uniqueRead * 2;
  document.getElementById('readingMinutes').textContent = `${minutes} min`;

  // Favorite category from history
  const cats = {};
  (history || []).forEach(h => { if(h.category){ cats[h.category] = (cats[h.category] || 0) + 1; } });
  const topCat = Object.entries(cats).sort((a,b) => b[1] - a[1])[0];
  document.getElementById('favoriteCategory').textContent = topCat ? `${topCat[0]} (${topCat[1]})` : '—';

  // Continue reading
  const reading = getReadingList();
  const contList = document.getElementById('continueReadingList');
  if(reading.length){
    contList.innerHTML = reading.slice(0, 5).map(item => `<a href="news.html?article=${encodeURIComponent(item.id)}" class="continue-item"><span>${item.title}</span><small>${item.category || 'News'} · ${item.progress || 0}% read</small></a>`).join('');
  } else {
    contList.innerHTML = '<em>No in-progress articles yet. Open an article in News to begin.</em>';
  }

  // Reading history
  const histEl = document.getElementById('readingHistoryList');
  if(history.length){
    histEl.innerHTML = history.slice(0, 10).map(h => `<li class="history-item"><a href="news.html?article=${encodeURIComponent(h.id)}"><span>${h.title}</span><small>${h.category || 'News'} · ${new Date(h.date + 'T00:00:00').toLocaleDateString()}</small></a></li>`).join('');
  } else {
    histEl.innerHTML = '<li class="history-empty"><em>Your reading history will appear here.</em></li>';
  }
}

// ------------------------------------------------------------------
// Premium search
// ------------------------------------------------------------------
function renderPremiumSearchFor(query){
  const results = document.getElementById('premiumSearchResults');
  const q = (query || '').trim().toLowerCase();
  if(!q){ results.innerHTML = ''; return; }
  const pins = getPinnedArticles();
  const history = getHistory();
  const combined = [];
  const seen = new Set();
  [...history, ...pins].forEach(item => {
    if(item && item.id && !seen.has(item.id)){ seen.add(item.id); combined.push(item); }
  });
  const matches = combined.filter(item =>
    (item.title || '').toLowerCase().includes(q) ||
    (item.summary || '').toLowerCase().includes(q) ||
    (item.author || '').toLowerCase().includes(q) ||
    (item.category || '').toLowerCase().includes(q)
  );
  if(!matches.length){
    results.innerHTML = '<div class="muted">No matches found.</div>';
    return;
  }
  results.innerHTML = matches.slice(0, 6).map(item => `<a href="news.html?article=${encodeURIComponent(item.id)}" class="premium-search-result"><span>${item.title}</span><small>${item.category || 'News'} · ${item.author || 'PressClub'}</small></a>`).join('');
}

function bindPremiumControls(){
  const searchInput = document.getElementById('premiumSearchInput');
  const searchBtn = document.getElementById('premiumSearchBtn');
  if(searchInput){
    searchInput.addEventListener('keydown', e => { if(e.key === 'Enter') renderPremiumSearch(); });
  }
  if(searchBtn){
    searchBtn.addEventListener('click', renderPremiumSearch);
  }
}

function renderPremiumSearch(){
  const input = document.getElementById('premiumSearchInput');
  if(input) renderPremiumSearchFor(input.value);
}

// Show subscription expiry info
function showSubscriptionInfo(){
  const sub = getSubscription();
  if(!sub || !sub.expiresAt) return;
  const expires = new Date(sub.expiresAt);
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - now) / (24 * 60 * 60 * 1000)));
  let message = '';
  if(sub.expired || daysLeft === 0){
    message = `⚠️ Your premium subscription has expired. Please make a new payment to renew.`;
  } else if(daysLeft <= 3){
    message = `⏳ Your premium subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${expires.toLocaleDateString()}). Renew soon to keep your access.`;
  } else {
    message = `✅ Premium active until ${expires.toLocaleDateString()} (${daysLeft} days left).`;
  }
  const info = document.getElementById('payerInfo');
  if(info) info.textContent = message;
}

async function verifyPayerWithServer(){
  // If not marked as payer locally, nothing to verify
  if(!isPayer()) return false;
  
  const phone = getLoggedInPhone();
  if(!phone) return false;
  
  try{
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await response.json();
    
    if(response.ok && data.ok){
      // Valid payer - update stored data
      localStorage.setItem('pressclub_isPayer', '1');
      localStorage.setItem('pressclub_phone', data.phone);
      localStorage.setItem('pressclub_session', data.sessionToken || '');
      saveOwnTransactions(data.transactions || []);
      localStorage.setItem(getSubKey(), JSON.stringify(data.subscription || null));
      
      if(data.status === 'expired'){
        localStorage.setItem('pressclub_isPayer', '0');
        localStorage.setItem('pressclub_expired', '1');
        return false;
      }
      localStorage.removeItem('pressclub_expired');
      return true;
    } else {
      // Not a valid payer - clear local flags
      localStorage.removeItem('pressclub_isPayer');
      localStorage.removeItem('pressclub_phone');
      localStorage.removeItem('pressclub_session');
      localStorage.removeItem('pressclub_expired');
      return false;
    }
  } catch(err){
    // Network error - keep local state but show a warning
    console.error('Failed to verify payer status:', err);
    return isPayer();
  }
}

function saveOwnTransactions(txs){
  localStorage.setItem(getTxsKey(), JSON.stringify(txs));
}

async function initDashboard(){
  const info = document.getElementById('payerInfo');
  
  // Verify payer status with the server before showing payer content
  const verified = await verifyPayerWithServer();
  
  if(!verified || !isPayer()){
    info.innerHTML = 'This browser is not signed in to a premium account. <a class="btn primary" href="news.html">Go to News and log in</a>';
    document.getElementById('payerControls').innerHTML = '<div class="dashboard-profile"><span class="eyebrow">Premium access</span><h3>Sign in to see your reading list</h3><p>Use the phone number you paid with, then return here to read and save premium articles.</p><a class="btn primary" href="news.html">Log in or verify payment</a></div>';
    document.querySelectorAll('.payment-value, .dashboard-bottom-grid, .premium-extras').forEach(section => section.hidden = true);
    document.getElementById('logoutPayerBtn').hidden = true;
    renderPins();
    bindPinControls();
    return;
  }
  const txs = getTransactions();
  const total = txs.reduce((sum, transaction) => sum + paymentValue(transaction.amount), 0);
  const latest = txs[0];
  showSubscriptionInfo();
  document.getElementById('payerStatus').textContent = 'Active';
  document.getElementById('payerPhone').textContent = getLoggedInPhone() || latest?.phone || 'Not provided';
  document.getElementById('totalPaid').textContent = formatNaira(total);
  document.getElementById('paymentTitle').textContent = total ? `${formatNaira(total)} premium payment` : 'Premium membership';
  document.getElementById('paymentSummary').textContent = total ? `Your payment of ${formatNaira(total)} supports PressClub and unlocks every premium feature below.` : 'Your verified payment gives you premium reading access.';
  document.getElementById('latestPayment').innerHTML = latest ? `<strong>Latest verified payment</strong><span>${formatNaira(paymentValue(latest.amount))} | ${new Date(latest.date).toLocaleDateString()} | Reference: ${latest.ref || 'Not provided'}</span>` : '<span>Your verified payment will appear here after login.</span>';
  document.getElementById('payerTransactions').innerHTML = txs.length ? txs.map(t => `<li><strong>${formatNaira(paymentValue(t.amount))}</strong><span>${new Date(t.date).toLocaleDateString()} | ${t.ref || 'No reference'}</span></li>`).join('') : '<li>No transactions found</li>';
  renderPins();
  bindPinControls();
  renderPremiumStats();
  bindPremiumControls();
  const adFree = document.getElementById('adFreeToggle');
  adFree.checked = localStorage.getItem(getAdfreeKey()) === '1';
  adFree.onchange = () => {
    localStorage.setItem(getAdfreeKey(), adFree.checked ? '1' : '0');
    info.textContent = adFree.checked ? '✅ Ad-free mode enabled for this account.' : 'Ad-free mode disabled.';
  };
  const compact = document.getElementById('compactToggle');
  compact.checked = localStorage.getItem(getCompactKey()) === '1';
  compact.onchange = () => {
    localStorage.setItem(getCompactKey(), compact.checked ? '1' : '0');
    info.textContent = compact.checked ? '✅ Compact cards enabled. You will see more articles per screen in News.' : 'Compact cards disabled.';
  };
  const notify = document.getElementById('notifyToggle');
  notify.checked = localStorage.getItem(getNotifyKey()) === '1';
  notify.onchange = () => {
    localStorage.setItem(getNotifyKey(), notify.checked ? '1' : '0');
    info.textContent = notify.checked ? '✅ Streak notifications enabled.' : 'Streak notifications disabled.';
  };
  document.getElementById('logoutPayerBtn').onclick = () => {
    // Clear session + per-user data for this account
    const phone = getLoggedInPhone();
    ['pressclub_isPayer','pressclub_phone','pressclub_session','pressclub_expired'].forEach(key => localStorage.removeItem(key));
    if(phone){
      [getTxsKey(), getPinnedKey(), getAdfreeKey(), getCompactKey(), getNotifyKey(), getSubKey(), getStatsKey(), getHistoryKey(), getReadingKey()].forEach(key => localStorage.removeItem(key));
    }
    location.href = 'news.html';
  };
}

function getPhone(){ return getLoggedInPhone(); }

initDashboard();

// Hamburger nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if(navToggle && navLinks){
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('active', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}