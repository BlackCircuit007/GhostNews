function isPayer(){ return localStorage.getItem('pressclub_isPayer') === '1'; }
function getLoggedInPhone(){ return localStorage.getItem('pressclub_phone') || ''; }
function getPinnedArticles(){ try { return JSON.parse(localStorage.getItem('pressclub_pinned_articles') || '[]'); } catch { return []; } }
function getTransactions(){ try { return JSON.parse(localStorage.getItem('pressclub_txs') || '[]'); } catch { return []; } }
function paymentValue(value){ return Number(String(value || '').replace(/[^0-9.]/g, '')) || 0; }
function formatNaira(value){ return 'NGN ' + new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value); }

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
    localStorage.setItem('pressclub_pinned_articles', JSON.stringify(getPinnedArticles().filter(article => article.id !== button.dataset.id)));
    renderPins();
  };
  document.getElementById('clearPinsBtn').onclick = () => { localStorage.removeItem('pressclub_pinned_articles'); renderPins(); };
}

function initDashboard(){
  const info = document.getElementById('payerInfo');
  if(!isPayer()){
    info.innerHTML = 'This browser is not signed in to a premium account. <a class="btn primary" href="news.html">Go to News and log in</a>';
    document.getElementById('payerControls').innerHTML = '<div class="dashboard-profile"><span class="eyebrow">Premium access</span><h3>Sign in to see your reading list</h3><p>Use the phone number you paid with, then return here to read and save premium articles.</p><a class="btn primary" href="news.html">Log in or verify payment</a></div>';
    document.querySelectorAll('.payment-value, .dashboard-bottom-grid').forEach(section => section.hidden = true);
    document.getElementById('logoutPayerBtn').hidden = true;
    renderPins();
    bindPinControls();
    return;
  }
  const txs = getTransactions();
  const total = txs.reduce((sum, transaction) => sum + paymentValue(transaction.amount), 0);
  const latest = txs[0];
  info.textContent = 'Welcome. Your verified payment has unlocked premium access.';
  document.getElementById('payerStatus').textContent = 'Active';
  document.getElementById('payerPhone').textContent = getLoggedInPhone() || latest?.phone || 'Not provided';
  document.getElementById('totalPaid').textContent = formatNaira(total);
  document.getElementById('paymentTitle').textContent = total ? `${formatNaira(total)} premium payment` : 'Premium membership';
  document.getElementById('paymentSummary').textContent = total ? `Your payment of ${formatNaira(total)} supports PressClub and unlocks every premium feature below.` : 'Your verified payment gives you premium reading access.';
  document.getElementById('latestPayment').innerHTML = latest ? `<strong>Latest verified payment</strong><span>${formatNaira(paymentValue(latest.amount))} | ${new Date(latest.date).toLocaleDateString()} | Reference: ${latest.ref || 'Not provided'}</span>` : '<span>Your verified payment will appear here after login.</span>';
  document.getElementById('payerTransactions').innerHTML = txs.length ? txs.map(t => `<li><strong>${formatNaira(paymentValue(t.amount))}</strong><span>${new Date(t.date).toLocaleDateString()} | ${t.ref || 'No reference'}</span></li>`).join('') : '<li>No transactions found</li>';
  renderPins();
  bindPinControls();
  const adFree = document.getElementById('adFreeToggle');
  adFree.checked = localStorage.getItem('pressclub_adfree') === '1';
  adFree.onchange = () => localStorage.setItem('pressclub_adfree', adFree.checked ? '1' : '0');
  document.getElementById('logoutPayerBtn').onclick = () => { ['pressclub_isPayer','pressclub_phone','pressclub_session','pressclub_txs'].forEach(key => localStorage.removeItem(key)); location.href = 'news.html'; };
}
initDashboard();
