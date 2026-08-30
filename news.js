// ======================================
// PRESSCLUB NEWS
// ======================================
// The news feed is served through the server-side proxy at /api/news.
// To enable live news:
//   1. Sign up at https://newsdata.io
//   2. Copy your API key from the dashboard
//   3. Set it as the NEWS_API_KEY environment variable on your host
// When no key is set (or the API is down), the site shows sample articles.
const categories = {
    local:{
    label:"Enugu News",
    title:"Enugu News",
    query:"Enugu Nigeria"
},

national:{
    label:"Nigeria",
    title:"Nigeria News",
    query:"Nigeria"
},

international:{
    label:"World",
    title:"World News",
    query:"World"
},

academic:{
    label:"Education",
    title:"Education News",
    query:"Education Nigeria"
},

sports:{
    label:"Sports",
    title:"Sports News",
    query:"Sports Nigeria"
}
};

const url = new URLSearchParams(window.location.search);

const requestedCategory = url.get("category");

const category =
requestedCategory === "custom"
? "custom"
: categories[requestedCategory]
? requestedCategory
: "national";

const customQuery = url.get("query") || "";

const selectedDate =
url.get("date") ||
new Date().toISOString().split("T")[0];

const categoryLabel =
document.getElementById("categoryLabel");

const pageTitle =
document.getElementById("pageTitle");

const articles =
document.getElementById("articles");

const detail =
document.getElementById("articleDetail");

const status =
document.getElementById("statusMessage");

const picker =
document.getElementById("datePicker");

const previous =
document.getElementById("prevDayBtn");

const next =
document.getElementById("nextDayBtn");

let articleList = [];
const requestedArticleId = url.get('article');

// Payer logic
const BECOME_PAYER_BTN_ID = "becomePayerBtn";
const PAYMENT_MODAL_ID = "paymentModal";
const CONFIRM_PAID_BTN_ID = "confirmPaidBtn";
const CLOSE_PAYMENT_MODAL_ID = "closePaymentModal";
const PAYER_DASHBOARD_LINK_ID = "payerDashboardLink";
const LOGIN_MODAL_ID = "loginModal";
const LOGIN_BTN_ID = "loginBtn";
const CLOSE_LOGIN_MODAL_ID = "closeLoginModal";
const SUBMIT_LOGIN_BTN_ID = "submitLoginBtn";
const PAY_NOW_BTN_ID = "payNowBtn";

function isPayer(){
    return localStorage.getItem("pressclub_isPayer")==="1";
}

function getLoggedInPhone(){
    return localStorage.getItem("pressclub_phone") || "";
}

// Per-user storage helpers
function getTxsKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_txs_${phone}` : 'pressclub_txs'; }
function getAdfreeKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_adfree_${phone}` : 'pressclub_adfree'; }
function getCompactKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_compact_${phone}` : 'pressclub_compact'; }
function getNotifyKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_notify_${phone}` : 'pressclub_notify'; }
function getSubKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_sub_${phone}` : 'pressclub_sub'; }

function getOwnTransactions(){ try { return JSON.parse(localStorage.getItem(getTxsKey()) || '[]'); } catch { return []; } }
function saveOwnTransactions(txs){ localStorage.setItem(getTxsKey(), JSON.stringify(txs)); }

// Per-user storage key so each account has its own pinned articles
function getPinnedKey(){
    const phone = getLoggedInPhone();
    return phone ? `pressclub_pinned_articles_${phone}` : 'pressclub_pinned_articles';
}

function setPayer(flag){
    localStorage.setItem("pressclub_isPayer", flag?"1":"0");
    updatePayerUI();
}

function updatePayerUI(){
    const link = document.getElementById(PAYER_DASHBOARD_LINK_ID);
    const btn = document.getElementById(BECOME_PAYER_BTN_ID);
    const loginBtn = document.getElementById(LOGIN_BTN_ID);
    if(!link || !btn) return;
    if(isPayer()){
        link.style.display="inline-block";
        btn.style.display="none";
        if(loginBtn) loginBtn.style.display="none";
    } else {
        link.style.display="none";
        btn.style.display="inline-block";
        if(loginBtn) loginBtn.style.display="inline-block";
    }
}

function openLoginModal(){
    const modal = document.getElementById(LOGIN_MODAL_ID);
    if(!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
}

function closeLoginModal(){
    const modal = document.getElementById(LOGIN_MODAL_ID);
    if(!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden","true");
}

function openPaymentModal(){
    const modal = document.getElementById(PAYMENT_MODAL_ID);
    if(!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
}

function closePaymentModal(){
    const modal = document.getElementById(PAYMENT_MODAL_ID);
    if(!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden","true");
}

document.addEventListener("click", (e) => {
    if(e.target && e.target.id === BECOME_PAYER_BTN_ID){
        openPaymentModal();
    }
    if(e.target && e.target.id === LOGIN_BTN_ID){
        openLoginModal();
    }
    if(e.target && e.target.id === CLOSE_LOGIN_MODAL_ID){
        closeLoginModal();
    }
    if(e.target && e.target.id === SUBMIT_LOGIN_BTN_ID){
        // Handle login with phone number (or the owner's secret stats code)
        const phone = document.getElementById('loginPhoneInput')?.value?.trim();
        if(!phone){
            alert('Please enter your phone number.');
            return;
        }
        // Owner door: if this is the secret owner code, unlock the hidden
        // stats dashboard instead of doing a payer login.
        fetch('/api/owner-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: phone })
        }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
          .then(() => {
              try { sessionStorage.setItem('pressclub_owner_code', phone); } catch(e) {}
              document.getElementById('loginPhoneInput').value = '';
              closeLoginModal();
              location.href = 'stats.html';
          })
          .catch(() => {
              // Not the owner code — continue with the normal payer login
              return fetch('/api/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone })
              }).then(r=>r.json())
              .then(data=>{
                  if(data.owner){
                      // Server recognized the owner code (fallback path)
                      try { sessionStorage.setItem('pressclub_owner_code', phone); } catch(e) {}
                      closeLoginModal();
                      location.href = 'stats.html';
                      return;
                  }
                  if(data.ok){
                localStorage.setItem('pressclub_isPayer', '1');
                localStorage.setItem('pressclub_phone', data.phone);
                localStorage.setItem('pressclub_session', data.sessionToken || '');
                saveOwnTransactions(data.transactions || []);
                localStorage.setItem(getSubKey(), JSON.stringify(data.subscription || {}));
                if(data.status === 'expired'){
                    localStorage.setItem('pressclub_isPayer', '0');
                    localStorage.setItem('pressclub_expired', '1');
                    alert('Your subscription has expired. Please renew to continue enjoying premium access.');
                    updatePayerUI();
                    return;
                }
                localStorage.removeItem('pressclub_expired');
                closeLoginModal();
                updatePayerUI();
                // Navigate to dashboard so the user sees their new premium access
                alert('Login successful! Taking you to your dashboard...');
                location.href = 'dashboard.html';
                  } else {
                      alert(data.message || 'Login failed. Please make a payment first.');
                  }
              })
              .catch(err=>{
                  console.error('Login error:', err);
                  alert('Login failed due to network or server error.');
              });
          });
    }
    if(e.target && e.target.id === CLOSE_PAYMENT_MODAL_ID){
        closePaymentModal();
    }
    if(e.target && e.target.id === PAY_NOW_BTN_ID){
        // Pay online instantly via Flutterwave (card, bank, USSD)
        const phone = document.getElementById('payerPhoneInput')?.value?.trim() || getLoggedInPhone();
        if(!phone){
            alert('Please enter the phone number for your account first.');
            document.getElementById('payerPhoneInput')?.focus();
            return;
        }
        const btn = e.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Creating secure payment link...';

        fetch('/api/initiate-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, email: phone.includes('@') ? phone : undefined })
        }).then(r=>r.json())
        .then(result=>{
            if(result.ok && result.paymentLink){
                localStorage.setItem('pressclub_pending_phone', phone);
                setVerificationStatus('Redirecting to secure payment...');
                window.location.href = result.paymentLink;
            } else {
                btn.disabled = false;
                btn.textContent = originalText;
                alert(result.message || 'Could not create a payment link. Please try the manual transfer option below.');
            }
        })
        .catch(err=>{
            btn.disabled = false;
            btn.textContent = originalText;
            console.error('Initiate payment error:', err);
            alert('Payment initiation failed. Please try the manual transfer option below.');
        });
    }
    if(e.target && e.target.id === CONFIRM_PAID_BTN_ID){
        // Gather fields and call verification endpoint
        const phone = document.getElementById('payerPhoneInput')?.value?.trim();
        const amount = document.getElementById('paymentAmountInput')?.value?.trim();
        const ref = document.getElementById('paymentRefInput')?.value?.trim();

        if(!phone || !amount || !ref){
            alert('Please fill phone, amount and transaction reference.');
            return;
        }

        // enforce fixed price
        if(String(amount) !== '5000'){
            alert('Payment must be exactly 5000 NGN.');
            return;
        }

        setVerificationButtonLoading(true);
        setVerificationStatus('Sending your verification request. Please wait...');

        // request owner email verification
        fetch('/api/request-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, amount, ref })
        }).then(r=>r.json())
        .then(result=>{
            if(result && result.ok){
                // show preview link when using Ethereal (dev)
                if(result.preview){
                    alert('Verification email sent (dev preview): ' + result.preview);
                } else if(result.emailSent){
                    setVerificationStatus('Request received. The owner has been emailed. Waiting for payment confirmation...');
                } else {
                    setVerificationStatus(result.message || 'Verification request saved. Waiting for the owner to confirm it manually.');
                }

                // store a pending token + phone locally to poll the server (use token returned if present)
                const token = result.token || ref;
                localStorage.setItem('pressclub_pending_token', token);
                localStorage.setItem('pressclub_pending_phone', phone);

                // poll for verification (attempts limited)
                let attempts = 0;
                const poll = setInterval(()=>{
                    attempts++;
                    setVerificationStatus(`Verification request is pending. Checking for owner confirmation... (${attempts})`);
                    fetch(`/api/check-token?token=${encodeURIComponent(token)}`).then(r=>r.json()).then(s=>{
                        if(s.verified){
                            clearInterval(poll);
                            setVerificationStatus('Payment confirmed. Please log in with your phone number to access premium features.');
                            const txs = getOwnTransactions();
                            txs.unshift({ phone, amount, ref, date: new Date().toISOString(), id: s.transactionId || token });
                            saveOwnTransactions(txs);
                            closePaymentModal();
                            localStorage.removeItem('pressclub_pending_token');
                            localStorage.removeItem('pressclub_pending_phone');
                            setVerificationButtonLoading(false);
                            setVerificationStatus('');
                            alert('Payment verified by owner! Please log in with your phone number to access premium features.');
                            openLoginModal();
                        } else if(attempts > 30){
                            clearInterval(poll);
                            setVerificationStatus('Still waiting for confirmation. You can safely close this page; PressClub will check again when you return.');
                        }
                    }).catch(()=>{});
                }, 3000);

            } else {
                setVerificationButtonLoading(false);
                setVerificationStatus('');
                alert('Could not send verification email.');
            }
        })
        .catch(err=>{
            setVerificationButtonLoading(false);
            setVerificationStatus('');
            console.error(err);
            alert('Verification request failed due to network or server error.');
        });
    }
});

// Expose a function to gate premium actions
function requirePayer(action){
    if(isPayer()){
        return action();
    }
    // show modal as nudge
    openPaymentModal();
}

function getPinnedArticles(){
    try { return JSON.parse(localStorage.getItem(getPinnedKey()) || '[]'); }
    catch { return []; }
}

function isPinned(id){ return getPinnedArticles().some(article => article.id === id); }

function togglePin(id){
    const article = getArticle(id);
    if(!article) return;
    const pins = getPinnedArticles();
    const existing = pins.findIndex(pin => pin.id === id);
    if(existing >= 0) pins.splice(existing, 1);
    else pins.unshift({ id: article.id, title: article.title, summary: article.summary, content: article.content, author: article.author, date: article.date, url: article.url, image: article.image });
    localStorage.setItem(getPinnedKey(), JSON.stringify(pins.slice(0, 50)));
    renderArticles();
    showStatus(existing >= 0 ? 'Article removed from your dashboard.' : 'Article saved to your dashboard.');
}

function formatDate(date){

    return date
        .toISOString()
        .split("T")[0];

}

function parseDate(str){

    return new Date(str);

}

function showStatus(text){

    status.textContent = text;

    status.style.display =
    text
    ? "block"
    : "none";

}
function truncate(text, length = 180){

    if(!text) return "";

    return text.length > length
        ? text.substring(0, length).trim() + "..."
        : text;

}

function setVerificationStatus(message){
    showStatus(message);
    const paymentStatus = document.getElementById('paymentStatus');
    if(paymentStatus){
        paymentStatus.textContent = message;
        paymentStatus.style.display = message ? 'block' : 'none';
    }
}

function setVerificationButtonLoading(loading){
    const button = document.getElementById(CONFIRM_PAID_BTN_ID);
    if(!button) return;
    button.disabled = loading;
    button.textContent = loading ? 'Verification pending...' : 'Verify Payment';
}

function isRestrictedFeedContent(content){
    return !content || /only available in paid plans|content unavailable|subscribe to continue/i.test(String(content));
}
function updateHeader(){

    if(category==="custom"){

        categoryLabel.textContent="Search";

        pageTitle.textContent=
        `"${customQuery}"`;

        return;

    }

    categoryLabel.textContent=
    categories[category].label;

    pageTitle.textContent=
    categories[category].title;

}

async function fetchNews(query,date){
    // News is fetched through the server proxy so the API key stays secret
    // and gracefully falls back to sample articles when the API is unavailable.
    const api = new URL("/api/news", window.location.origin);

    api.searchParams.set("q", query || "");
    api.searchParams.set("size", "10");
    if(date) api.searchParams.set("date", date);

    console.log("REQUEST:", api.toString());

    const response = await fetch(api);
    const json = await response.json();

    console.log("RESPONSE:", json);

    if(json.ok && json.results && json.results.length){
        return json.results;
    }

    if(json.message){
        console.warn(json.message);
    }

    return json.results || [];
}

function normalize(item){

    const providerContent = item.content || '';

    return {

        id:item.article_id,

        title:item.title || "No title",

        author:
        item.creator?.[0] ||
        "Unknown Author",


summary:
truncate(
    item.description ||
    item.content ||
    "No summary available."
),

content: isRestrictedFeedContent(providerContent) ? '' : providerContent,

contentAvailable: !isRestrictedFeedContent(providerContent),


        image:
        item.image_url || "",


        url:
        item.link,


        date:
        new Date(item.pubDate)
        .toLocaleDateString(),


        publishedAt:
        new Date(item.pubDate)

    };

}

// Mock news data for fallback
const mockArticles = [
    {
        article_id: "mock_1",
        title: "Tech Innovation Transforms Nigeria",
        description: "New technology initiatives are changing how Nigerians work and communicate.",
        content: "New technology initiatives are changing how Nigerians work and communicate. Companies across the nation are adopting digital solutions to improve productivity and reach.",
        creator: ["Tech News Nigeria"],
        image_url: "https://via.placeholder.com/400x250?text=Tech+News",
        link: "https://example.com/tech-news",
        pubDate: new Date().toISOString()
    },
    {
        article_id: "mock_2",
        title: "Sports: Local Teams Advance",
        description: "Local sports teams achieve major victories in national championships.",
        content: "Local sports teams achieve major victories in national championships. The competitions continue to draw massive crowds and support from fans across the region.",
        creator: ["Sports Reporter"],
        image_url: "https://via.placeholder.com/400x250?text=Sports",
        link: "https://example.com/sports",
        pubDate: new Date(Date.now() - 86400000).toISOString()
    },
    {
        article_id: "mock_3",
        title: "Education: New Scholarship Program Launched",
        description: "Government announces expanded scholarship opportunities for students.",
        content: "Government announces expanded scholarship opportunities for students. The new program aims to support talented youth in pursuing higher education both domestically and internationally.",
        creator: ["Education Editor"],
        image_url: "https://via.placeholder.com/400x250?text=Education",
        link: "https://example.com/education",
        pubDate: new Date(Date.now() - 172800000).toISOString()
    }
];

function getHistory(){
    try { return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]'); } catch { return []; }
}
function getReadingList(){
    try { return JSON.parse(localStorage.getItem(getReadingKey()) || '[]'); } catch { return []; }
}

async function loadNews(){

    articles.innerHTML =
    "<h3>Loading...</h3>";

    detail.innerHTML="";

    showStatus("");

    const query =
    customQuery ||
    categories[category].query;

    console.log(query);

    try{

        const results =
await fetchNews(
    query,
    selectedDate
);

        articleList =
        results.map(normalize);

        const savedArticle = requestedArticleId && (
            getPinnedArticles().find(article => article.id === requestedArticleId) ||
            getHistory().find(article => article.id === requestedArticleId) ||
            getReadingList().find(article => article.id === requestedArticleId)
        );
        if(savedArticle && !articleList.some(article => article.id === savedArticle.id)){
            articleList.unshift(savedArticle);
        }

        if(articleList.length===0){

            articles.innerHTML=
            "<h2>No news found.</h2>";

            return;

        }

        renderArticles();
        if(requestedArticleId && getArticle(requestedArticleId)){
            showArticle(requestedArticleId);
        }

    }

    catch(error){

        console.error(error);

        // Fallback to mock data when API fails
        console.log("API unavailable, using mock data");
        articleList = mockArticles.map(normalize);
        
        if(articleList.length > 0){
            renderArticles();
            showStatus("鈿狅笍 Live feed currently unavailable. Showing sample news. Please add a valid newsdata.io API key to enable live updates.");
        } else {
            articles.innerHTML = "<h2>Unable to load news feed</h2>";
            showStatus(error.message);
        }

    }

}

function applyUserPrefs(){
    // Compact cards (per-user)
    const isCompact = localStorage.getItem(getCompactKey()) === '1';
    document.body.classList.toggle('compact-mode', isCompact);

    // Ad-free mode (per-user)
    const isAdFree = localStorage.getItem(getAdfreeKey()) === '1';
    document.body.classList.toggle('ad-free-mode', isAdFree);
    if(isAdFree){
        document.querySelectorAll('[data-ad], .ad-placeholder, .promo-banner, .ad-slot').forEach(el => el.hidden = true);
    } else {
        document.querySelectorAll('[data-ad], .ad-placeholder, .promo-banner, .ad-slot').forEach(el => el.hidden = false);
    }
}

function renderArticles(){

    articles.innerHTML = "";

    // Apply per-user preferences (compact + ad-free)
    applyUserPrefs();

    articleList.forEach(article => {

        const card = document.createElement("article");

        card.className = "article-card";

        card.innerHTML = `

            ${article.image ? `
                <img
                    src="${article.image}"
                    class="article-image"
                    alt="${article.title}"
                    loading="lazy">
            ` : ""}

            <div class="article-meta">
                <span>${article.date}</span>
                <span>${article.author}</span>
            </div>

            <h3>${article.title}</h3>

            <p>${article.summary}</p>

            <div class="article-actions">

                ${isPayer() ? `
                <button
                    class="btn primary read-btn"
                    data-id="${article.id}">
                    馃摉 Read Full Article
                </button>
                ` : `
                <button
                    class="btn primary read-btn"
                    data-id="${article.id}">
                    馃憗锔?Preview (Payer Only)
                </button>
                `}

                <button
                    class="btn secondary pdf-btn"
                    data-id="${article.id}"
                    ${!isPayer() ? 'title="Premium Feature - Become a Payer"' : ''}>
                    ${isPayer() ? 'PDF' : 'PDF (Payer)'}
                </button>

                <button
                    class="btn secondary doc-btn"
                    data-id="${article.id}"
                    ${!isPayer() ? 'title="Premium Feature - Become a Payer"' : ''}>
                    ${isPayer() ? 'DOCX' : 'DOCX (Payer)'}
                </button>

                ${isPayer() ? `
                <button class="btn ${isPinned(article.id) ? 'primary' : 'secondary'} pin-btn" data-id="${article.id}">${isPinned(article.id) ? '鉁?Saved' : '馃搶 Save to dashboard'}</button>
                ` : `
                <button class="btn secondary pin-btn" data-id="${article.id}">馃搶 Save to dashboard</button>
                `}

            </div>

        `;

        articles.appendChild(card);

    });

}

function getArticle(id){

    return articleList.find(a=>a.id===id);

}

function getStatsKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_stats_${phone}` : 'pressclub_stats'; }
function getHistoryKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_history_${phone}` : 'pressclub_history'; }
function getReadingKey(){ const phone = getLoggedInPhone(); return phone ? `pressclub_reading_${phone}` : 'pressclub_reading'; }

function trackArticleRead(article){
    if(!isPayer() || !article) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        // History (store full details so the article can be re-opened later)
        const history = JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
        const existing = history.findIndex(h => h.id === article.id);
        const entry = { id: article.id, title: article.title, summary: article.summary || '', content: article.content || '', author: article.author, date: today, url: article.url || '', image: article.image || '', category };
        if(existing >= 0) history.splice(existing, 1);
        history.unshift(entry);
        localStorage.setItem(getHistoryKey(), JSON.stringify(history.slice(0, 100)));
        // Stats / streak
        const stats = JSON.parse(localStorage.getItem(getStatsKey()) || '{}');
        const readDates = stats.readDates || [];
        if(!readDates.includes(today)) readDates.push(today);
        stats.readDates = readDates.slice(-90);
        stats.lastRead = today;
        localStorage.setItem(getStatsKey(), JSON.stringify(stats));
        // Reading progress
        const reading = JSON.parse(localStorage.getItem(getReadingKey()) || '[]');
        const readingIdx = reading.findIndex(r => r.id === article.id);
        const readingEntry = { id: article.id, title: article.title, summary: article.summary || '', content: article.content || '', category, progress: 25, updated: Date.now() };
        if(readingIdx >= 0) reading.splice(readingIdx, 1);
        reading.unshift(readingEntry);
        localStorage.setItem(getReadingKey(), JSON.stringify(reading.slice(0, 20)));
    } catch(err){ /* silent */ }
}

function showSubscriptionNotice(){
    if(!isPayer()) return;
    try{
        const sub = JSON.parse(localStorage.getItem(getSubKey()) || 'null');
        if(!sub || !sub.expiresAt) return;
        const expires = new Date(sub.expiresAt);
        const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        if(sub.expired || daysLeft === 0){
            showStatus('鈿狅笍 Your premium subscription has expired. Please make a new payment to renew your access.');
        } else if(daysLeft <= 3){
            showStatus(`鈴?Your premium subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${expires.toLocaleDateString()}). Renew soon to keep your access.`);
        }
    }catch(err){ /* silent */ }
}

function showStreakReminder(){
    if(!isPayer()) return;
    if(localStorage.getItem(getNotifyKey()) !== '1') return;
    try{
        const stats = JSON.parse(localStorage.getItem(getStatsKey()) || '{}');
        const readDates = stats.readDates || [];
        const today = new Date().toISOString().split('T')[0];
        if(readDates.includes(today)) return; // already read today
        // Compute current streak
        const dates = [...new Set(readDates)].sort().reverse();
        let streak = 0;
        let cursor = new Date();
        cursor.setDate(cursor.getDate() - 1);
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
        if(streak > 0){
            // Only remind every 6 hours
            const lastReminder = stats.lastReminder || 0;
            if(Date.now() - lastReminder < 6 * 60 * 60 * 1000) return;
            stats.lastReminder = Date.now();
            localStorage.setItem(getStatsKey(), JSON.stringify(stats));
            showStatus(`馃敟 You're on a ${streak}-day reading streak! Read an article today to keep it going.`);
        }
    }catch(err){ /* silent */ }
}
function markArticleDone(article){
    if(!isPayer() || !article) return;
    try{
        const reading = JSON.parse(localStorage.getItem(getReadingKey()) || '[]');
        const idx = reading.findIndex(r => r.id === article.id);
        if(idx >= 0){
            reading[idx].progress = 100;
            reading[idx].completed = true;
            localStorage.setItem(getReadingKey(), JSON.stringify(reading));
        } else {
            reading.unshift({ id: article.id, title: article.title, summary: article.summary || '', content: article.content || '', category, progress: 100, completed: true, updated: Date.now() });
            localStorage.setItem(getReadingKey(), JSON.stringify(reading.slice(0, 20)));
        }
        showStatus('鉁?Marked as read.');
    }catch(err){ /* silent */ }
}

async function showArticle(id){

    const article=getArticle(id);

    if(!article) return;

    // Check if user is a payer; show full article only to payers
    if(isPayer()){
        // Track premium reading for payers
        trackArticleRead(article);
    }

    if(!isPayer()){
        // Show preview to non-payers with paywall
        detail.innerHTML=`

            <h2>${article.title}</h2>

            <div class="detail-meta">

                <span>${article.author}</span>

                <span>${article.date}</span>

            </div>

            ${
                article.image
                ?
                `<img
                    src="${article.image}"
                    class="detail-image">`
                :
                ""
            }

            <p style="font-style: italic; color: var(--muted);">

            ${article.summary}

            </p>

            <div style="padding: 20px; background: var(--card-bg); border-radius: 8px; margin: 20px 0; text-align: center;">
                <h3>Premium Content</h3>
                <p>Become a payer to read the full article and access premium features.</p>
                <button class="btn primary" onclick="openPaymentModal()">Unlock Full Article</button>
            </div>

            <a
            href="${article.url}"
            target="_blank"
            class="btn secondary">

            Read Original Article (External Link)

            </a>

        `;
    } else {
        // Show full article to payers
        detail.innerHTML=`

            <h2>${article.title}</h2>

            <div class="detail-meta">

                <span>${article.author}</span>

                <span>${article.date}</span>

            </div>

            ${
                article.image
                ?
                `<img
                    src="${article.image}"
                    class="detail-image">`
                :
                ""
            }

            ${article.contentAvailable !== false && !isRestrictedFeedContent(article.content) ? `
                <div class="premium-article-label">Premium full article</div>
                <p>${article.content}</p>
            ` : `
                <div class="source-only-notice">
                    <strong>Full publisher text is not included in this news feed.</strong>
                    <p>PressClub has saved the article details, but the publisher keeps the complete story on its website. Use the button below to read it directly from the source.</p>
                </div>
            `}

            <div class="article-reading-info">
                <span><strong>Publisher:</strong> ${article.author}</span>
                <span><strong>Published:</strong> ${article.date}</span>
                <span><strong>Reading access:</strong> ${article.contentAvailable !== false && !isRestrictedFeedContent(article.content) ? 'Full feed text' : 'Publisher article link'}</span>
            </div>

            <br>

            <div class="detail-actions">
            <button class="btn primary done-btn" data-id="${article.id}" type="button">鉁?Mark as read</button>

            <a
            href="${article.url}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn secondary">

            Read full article at publisher

            </a>
            </div>

        `;
    }

    detail.classList.add("visible");

    detail.scrollIntoView({

        behavior:"smooth"

    });

}

function loadScript(src){
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

// Lazy-load jsPDF only when needed
let jspdfPromise = null;
function ensureJspdf(){
    if(window.jspdf) return Promise.resolve();
    if(!jspdfPromise){
        jspdfPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    return jspdfPromise;
}

function downloadPDF(article){

    if(!isPayer()){
        alert('Full downloads are a premium feature. Please become a payer to download articles.');
        openPaymentModal();
        return;
    }

    ensureJspdf().then(() => {
        if(!window.jspdf){
            alert('PDF library failed to load. Please check your internet connection.');
            return;
        }

        const {jsPDF}=window.jspdf;

        const pdf=new jsPDF();

        pdf.setFontSize(18);

        pdf.text(article.title,20,20);

        pdf.setFontSize(11);

        pdf.text(article.author,20,35);

        pdf.text(article.date,20,45);

        const lines=

        pdf.splitTextToSize(

            article.content,

            170

        );

        pdf.text(lines,20,60);

        pdf.save(

            article.title+".pdf"

        );
    }).catch(() => {
        alert('Failed to load PDF library. Please check your internet connection.');
    });

}

// Lazy-load docx library only when needed
let docxPromise = null;
function ensureDocx(){
    if(window.docx) return Promise.resolve();
    if(!docxPromise){
        docxPromise = loadScript('https://unpkg.com/docx@8.1.0/build/index.umd.js');
    }
    return docxPromise;
}

async function downloadDOC(article){

    if(!isPayer()){
        alert('Full downloads are a premium feature. Please become a payer to download articles.');
        openPaymentModal();
        return;
    }

    try {
        await ensureDocx();
        if(!window.docx){
            alert('DOCX library failed to load. Please check your internet connection.');
            return;
        }

        const {

            Document,

            Paragraph,

            Packer,

            HeadingLevel

        }=docx;

        const document=

        new Document({

            sections:[{

                children:[

                    new Paragraph({

                        text:article.title,

                        heading:

                        HeadingLevel.TITLE

                    }),

                    new Paragraph({

                        text:article.author

                    }),

                    new Paragraph({

                        text:article.date

                    }),

                    new Paragraph({

                        text:article.content

                    })

                ]

            }]

        });

        const blob=

        await Packer.toBlob(document);

        const link=

        document.createElement("a");

        link.href=

        URL.createObjectURL(blob);

        link.download=

        article.title+".docx";

        link.click();
    } catch(err) {
        alert('Failed to load DOCX library. Please check your internet connection.');
    }

}

articles.addEventListener("click",(e)=>{

    const read=e.target.closest(".read-btn");

    const pdf=e.target.closest(".pdf-btn");

    const doc=e.target.closest(".doc-btn");

    const pin=e.target.closest('.pin-btn');
    const done=e.target.closest('.done-btn');

    if(done){
        markArticleDone(getArticle(done.dataset.id));
    }

    if(read){

        showArticle(read.dataset.id);

    }

    if(pdf){

        downloadPDF(

            getArticle(

                pdf.dataset.id

            )

        );

    }

    if(doc){

        downloadDOC(

            getArticle(

                doc.dataset.id

            )

        );

    }

    if(pin){
        togglePin(pin.dataset.id);
    }

});

previous.onclick=()=>{

    const d=new Date(selectedDate);

    d.setDate(d.getDate()-1);

    location.href=

    `news.html?category=${category}&query=${customQuery}&date=${formatDate(d)}`;

};

next.onclick=()=>{

    const d=new Date(selectedDate);

    d.setDate(d.getDate()+1);

    location.href=

    `news.html?category=${category}&query=${customQuery}&date=${formatDate(d)}`;

};

picker.value=selectedDate;

picker.onchange=e=>{

    location.href=

    `news.html?category=${category}&query=${customQuery}&date=${e.target.value}`;

};

updateHeader();

updatePayerUI();

loadNews();

// Show subscription expiry awareness for payers
showSubscriptionNotice();

// Show streak reminder for payers with notifications enabled
showStreakReminder();

// ------------------------------------------------------------------
// Resume verification polling on page load.
// If a payer submitted a payment, closed the tab, and the owner
// verified it later (e.g. from another country), this re-checks the
// pending token and auto-logs the payer in when verified.
// ------------------------------------------------------------------
(function resumePendingVerification(){
  const pendingToken = localStorage.getItem('pressclub_pending_token');
  if(!pendingToken) return;

  // If already a payer, no need to poll
  if(isPayer()){
    localStorage.removeItem('pressclub_pending_token');
    return;
  }

  // Recover the phone used for the payment (stored when submitting)
  const pendingPhone = localStorage.getItem('pressclub_pending_phone') || '';

  let attempts = 0;
  const poll = setInterval(()=>{
    attempts++;
    fetch(`/api/check-token?token=${encodeURIComponent(pendingToken)}`).then(r=>r.json()).then(s=>{
      if(s.verified){
        clearInterval(poll);
        const phone = pendingPhone;
        const txs = getOwnTransactions();
        txs.unshift({ phone, amount: s.amount || '', ref: s.ref || '', date: new Date().toISOString(), id: s.transactionId || pendingToken });
        saveOwnTransactions(txs);
        localStorage.removeItem('pressclub_pending_token');
        localStorage.removeItem('pressclub_pending_phone');
        alert('Your payment was verified! Please log in with your phone number to access premium features.');
        openLoginModal();
      } else if(attempts > 60){ // ~3 minutes of polling
        clearInterval(poll);
        // Keep the token so it resumes again on next page load
      }
    }).catch(()=>{});
  }, 3000);
})();

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

// Open the payment modal when arriving via #become-payer (e.g. from the homepage)
document.addEventListener('DOMContentLoaded', () => {
  if(window.location.hash === '#become-payer' && !isPayer()){
    setTimeout(openPaymentModal, 600);
  }
});

// Close modals when the Escape key is pressed
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    closePaymentModal();
    closeLoginModal();
  }
});


