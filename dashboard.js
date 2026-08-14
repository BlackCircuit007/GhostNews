// Simple dashboard logic
function isPayer(){
    return localStorage.getItem("pressclub_isPayer")==="1";
}

function getLoggedInPhone(){
    return localStorage.getItem("pressclub_phone") || "";
}

function initDashboard(){
    const info = document.getElementById('payerInfo');
    const logout = document.getElementById('logoutPayerBtn');
    const statusEl = document.getElementById('payerStatus');
    const phoneEl = document.getElementById('payerPhone');
    const txList = document.getElementById('payerTransactions');
    const adFree = document.getElementById('adFreeToggle');
    if(!isPayer()){
        info.textContent = 'You are not recognized as a payer. Please return to News and Become a Payer.';
        logout.style.display = 'none';
        return;
    }
    info.textContent = 'Welcome — your payer account is active. Thank you for supporting PressClub.';
    statusEl.textContent = 'Active';

    const txs = JSON.parse(localStorage.getItem('pressclub_txs')||'[]');
    // Use the stored logged-in phone number first, fall back to transaction data
    phoneEl.textContent = getLoggedInPhone() || txs[0]?.phone || 'Not provided';
    txList.innerHTML = txs.length ? txs.map(t=>`<li>${t.date.split('T')[0]} — ${t.amount} NGN — ${t.ref}</li>`).join('') : '<li>No transactions found</li>';

    adFree.checked = localStorage.getItem('pressclub_adfree') === '1';
    adFree.onchange = ()=>{
        localStorage.setItem('pressclub_adfree', adFree.checked ? '1' : '0');
        alert('Ad-free preference saved locally.');
    };
    logout.onclick = ()=>{
        // Clear all session data on logout
        localStorage.setItem('pressclub_isPayer','0');
        localStorage.removeItem('pressclub_phone');
        localStorage.removeItem('pressclub_session');
        localStorage.removeItem('pressclub_txs');
        location.href = 'news.html';
    };
}

// Small helper to open dashboard
function openDashboard(){
    location.href = 'dashboard.html';
}

initDashboard();