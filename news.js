// ======================================
// PRESSCLUB NEWS
// ======================================
// To enable live news feed: 
// 1. Sign up at https://newsdata.io
// 2. Copy your API key from dashboard
// 3. Replace the key below (it currently has expired/invalid credentials)
// 4. The app will show mock data if the API is unavailable

const apikey = "pub_91280638adbd44d29938ea34a78b9e64"; // TODO: Replace with valid API key from newsdata.io

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

function isPayer(){
    return localStorage.getItem("pressclub_isPayer")==="1";
}

function getLoggedInPhone(){
    return localStorage.getItem("pressclub_phone") || "";
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

// Auto-login with phone number after payment verification
async function autoLoginWithPhone(phone){
    try{
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await response.json();
        if(response.ok && data.ok){
            // Store login session
            localStorage.setItem('pressclub_isPayer', '1');
            localStorage.setItem('pressclub_phone', data.phone);
            localStorage.setItem('pressclub_session', data.sessionToken || '');
            localStorage.setItem('pressclub_txs', JSON.stringify(data.transactions || []));
            updatePayerUI();
            console.log('Auto-login successful for phone:', data.phone);
            return true;
        } else {
            console.warn('Auto-login failed:', data.message);
            return false;
        }
    } catch(err){
        console.error('Auto-login error:', err);
        return false;
    }
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
        // Handle login with phone number
        const phone = document.getElementById('loginPhoneInput')?.value?.trim();
        if(!phone){
            alert('Please enter your phone number.');
            return;
        }
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        }).then(r=>r.json())
        .then(data=>{
            if(data.ok){
                localStorage.setItem('pressclub_isPayer', '1');
                localStorage.setItem('pressclub_phone', data.phone);
                localStorage.setItem('pressclub_session', data.sessionToken || '');
                localStorage.setItem('pressclub_txs', JSON.stringify(data.transactions || []));
                closeLoginModal();
                updatePayerUI();
                alert('Login successful! Welcome back, ' + data.phone);
            } else {
                alert(data.message || 'Login failed. Please make a payment first.');
            }
        })
        .catch(err=>{
            console.error('Login error:', err);
            alert('Login failed due to network or server error.');
        });
    }
    if(e.target && e.target.id === CLOSE_PAYMENT_MODAL_ID){
        closePaymentModal();
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

        showStatus('Requesting verification email...');

        // request owner email verification
        fetch('/api/request-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, amount, ref })
        }).then(r=>r.json())
        .then(result=>{
            showStatus('');
            if(result && result.ok){
                // show preview link when using Ethereal (dev)
                if(result.preview){
                    alert('Verification email sent (dev preview): ' + result.preview);
                } else {
                    alert('Verification email sent to site owner. You will be enabled after owner confirms.');
                }

                // store a pending token + phone locally to poll the server (use token returned if present)
                const token = result.token || ref;
                localStorage.setItem('pressclub_pending_token', token);
                localStorage.setItem('pressclub_pending_phone', phone);

                // poll for verification (attempts limited)
                let attempts = 0;
                const poll = setInterval(()=>{
                    attempts++;
                    fetch(`/api/check-token?token=${encodeURIComponent(token)}`).then(r=>r.json()).then(s=>{
                        if(s.verified){
                            clearInterval(poll);
                            // Immediately auto-login the user with the phone number used for payment
                            autoLoginWithPhone(phone).then((loggedIn)=>{
                                const txs = JSON.parse(localStorage.getItem('pressclub_txs')||'[]');
                                txs.unshift({ phone, amount, ref, date: new Date().toISOString(), id: s.transactionId || token });
                                localStorage.setItem('pressclub_txs', JSON.stringify(txs));
                                closePaymentModal();
                                localStorage.removeItem('pressclub_pending_token');
                                if(loggedIn){
                                    alert('Payment verified! You are now logged in as ' + phone + ' and have payer access.');
                                } else {
                                    alert('Payment verified by owner. You are now a payer.');
                                }
                            });
                        } else if(attempts > 30){
                            clearInterval(poll);
                            alert('Verification pending. Owner has not yet confirmed.');
                        }
                    }).catch(()=>{});
                }, 3000);

            } else {
                alert('Could not send verification email.');
            }
        })
        .catch(err=>{
            showStatus('');
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

    const api = new URL(
        "https://newsdata.io/api/1/latest"
    );


    api.searchParams.set(
        "apikey",
        apikey
    );


    api.searchParams.set(
        "q",
        query
    );


    api.searchParams.set(
        "country",
        "ng"
    );


    api.searchParams.set(
        "language",
        "en"
    );


api.searchParams.set(
    "size",
    "10"
);


    console.log("REQUEST:", api.toString());


    const response = await fetch(api);


    const json = await response.json();


    console.log("RESPONSE:", json);


    if(json.status !== "success"){

        const errorMsg = json.results?.message || json.message || "News loading failed";
        throw new Error(errorMsg);

    }


    return json.results || [];

}
function normalize(item){

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

content:
item.content ||
item.description ||
"Click 'Read Original Article' for the complete story.",


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

        if(articleList.length===0){

            articles.innerHTML=
            "<h2>No news found.</h2>";

            return;

        }

        renderArticles();

    }

    catch(error){

        console.error(error);

        // Fallback to mock data when API fails
        console.log("API unavailable, using mock data");
        articleList = mockArticles.map(normalize);
        
        if(articleList.length > 0){
            renderArticles();
            showStatus("⚠️ Live feed currently unavailable. Showing sample news. Please add a valid newsdata.io API key to enable live updates.");
        } else {
            articles.innerHTML = "<h2>Unable to load news feed</h2>";
            showStatus(error.message);
        }

    }

}

function renderArticles(){

    articles.innerHTML = "";

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
                    📖 Read Full Article
                </button>
                ` : `
                <button
                    class="btn primary read-btn"
                    data-id="${article.id}">
                    👁️ Preview (Payer Only)
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
                <button class="btn primary" data-id="${article.id}" onclick="alert('Pinned to your dashboard')">📌 Pin</button>
                ` : `
                <button class="btn secondary" onclick="requirePayer(()=>alert('Preview: Pinned posts are a payer feature'))">📌 Pin (Payer)</button>
                `}

            </div>

        `;

        articles.appendChild(card);

    });

}

function getArticle(id){

    return articleList.find(a=>a.id===id);

}

function showArticle(id){

    const article=getArticle(id);

    if(!article) return;

    // Check if user is a payer; show full article only to payers
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

            <p>

            ${article.content}

            </p>

            <br>

            <a
            href="${article.url}"
            target="_blank"
            class="btn primary">

            Read Original Article

            </a>

        `;
    }

    detail.classList.add("visible");

    detail.scrollIntoView({

        behavior:"smooth"

    });

}

function downloadPDF(article){

    if(!isPayer()){
        alert('Full downloads are a premium feature. Please become a payer to download articles.');
        openPaymentModal();
        return;
    }

    if(!window.jspdf){

        alert("jsPDF missing");

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

}

async function downloadDOC(article){

    if(!isPayer()){
        alert('Full downloads are a premium feature. Please become a payer to download articles.');
        openPaymentModal();
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

}

articles.addEventListener("click",(e)=>{

    const read=e.target.closest(".read-btn");

    const pdf=e.target.closest(".pdf-btn");

    const doc=e.target.closest(".doc-btn");

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
        autoLoginWithPhone(phone).then((loggedIn)=>{
          const txs = JSON.parse(localStorage.getItem('pressclub_txs')||'[]');
          txs.unshift({ phone, amount: s.amount || '', ref: s.ref || '', date: new Date().toISOString(), id: s.transactionId || pendingToken });
          localStorage.setItem('pressclub_txs', JSON.stringify(txs));
          localStorage.removeItem('pressclub_pending_token');
          localStorage.removeItem('pressclub_pending_phone');
          if(loggedIn){
            alert('Your payment was verified! You are now logged in as ' + phone + ' with payer access.');
          } else {
            alert('Your payment was verified! You are now a payer.');
          }
        });
      } else if(attempts > 60){ // ~3 minutes of polling
        clearInterval(poll);
        // Keep the token so it resumes again on next page load
      }
    }).catch(()=>{});
  }, 3000);
})();
