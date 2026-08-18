// ======================================
// PRESSCLUB DISPLAY ADS
// Real clickable sponsored banners
// Supports pay-per-view ads API (Roku compatible)
// ======================================
(function(){
  // ------------------------------------------------------------------
  // Ad config - add/edit sponsored ads here
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Pay-per-view Ads API config
  // ------------------------------------------------------------------
  const ADS_API_CONFIG = {
    // API endpoint for pay-per-view ads (Roku compatible)
    endpoint: 'https://ads.presclub.io/v1/ads',
    // API key for authentication (set in .env or Render dashboard)
    apiKey: process.env.ADS_API_KEY || '',
    // Whether API is enabled
    enabled: process.env.ENABLE_ADS_API === 'true',
    // Fallback to local ads when API fails
    fallbackToLocal: true
  };

  // Small deterministic string hash so ads rotate daily
  function hashString(str){
    let hash = 0;
    for(let i = 0; i < str.length; i++){
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Rotate the library based on the day so the same ad isn't always first
  function getAdsForDay(){
    const day = new Date().toISOString().split('T')[0];
    const start = hashString(day) % AD_LIBRARY.length;
    return AD_LIBRARY.slice(start).concat(AD_LIBRARY.slice(0, start));
  }

  function isAdFree(){
    try{
      // Payers can enable ad-free mode from the dashboard
      const phone = localStorage.getItem('pressclub_phone') || '';
      const key = phone ? `pressclub_adfree_${phone}` : 'pressclub_adfree';
      return localStorage.getItem(key) === '1';
    }catch(err){
      return false;
    }
  }

  // Load ads from API with fallback to local ads
  async function loadAdsFromAPI(){
    if(!ADDS_API_CONFIG.enabled || !ADDS_API_CONFIG.apiKey) return null;
    
    try{
      const resp = await fetch(ADDS_API_CONFIG.endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADDS_API_CONFIG.apiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if(!resp.ok) throw new Error('API request failed');
      
      const data = await resp.json();
      // Return ads data from API, or null if no ads available
      return data.ads || null;
    }catch(err){
      console.error('Failed to load ads from API:', err.message);
      return null;
    }
  }

  function renderAds(){
    // If payer has ad-free enabled, keep ads hidden
    if(isAdFree()){
      document.querySelectorAll('[data-ad], .ad-placeholder, .ad-slot').forEach(el => {
        el.hidden = true;
        el.style.display = 'none';
      });
      return;
    }

    const slots = document.querySelectorAll('.ad-placeholder[data-ad]');
    if(!slots.length) return;

    // Try to load ads from API first
    const apiAds = await loadAdsFromAPI();
    
    // Use API ads if available and has enough ads, otherwise fall back to local
    const ads = apiAds && apiAds.length >= slots.length ? apiAds : getAdsForDay();

    slots.forEach((slot, index) => {
      const ad = ads[index % ads.length];
      if(!ad) return;

      slot.hidden = false;
      slot.style.display = '';

      // Build the clickable sponsored banner
      slot.innerHTML = `
        <a class="ad-banner" href="${ad.link}" target="_blank" rel="noopener noreferrer sponsored" title="${ad.alt}" data-ad-id="${ad.id}">
          <img src="${ad.image}" alt="${ad.alt}" class="ad-banner__image" width="728" height="90" loading="lazy" />
          <span class="ad-banner__label">${ad.label} · PressClub</span>
        </a>
      `;
    });
  }

  // Track ad impression for payment
  function trackAdImpression(adId){
    if(!ADDS_API_CONFIG.enabled || !ADDS_API_CONFIG.apiKey) return;
    
    try{
      fetch(ADDS_API_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADDS_API_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'impression',
          adId: adId,
          timestamp: new Date().toISOString(),
          userId: localStorage.getItem('pressclub_phone') || 'anonymous'
        })
      }).catch(err => console.error('Failed to track ad impression:', err.message));
    }catch(err){
      console.error('Failed to track ad impression:', err.message);
    }
  }

  // Re-render if ad-free mode changes in another tab
  window.addEventListener('storage', (e) => {
    if(e.key && e.key.indexOf('pressclub_adfree') !== -1){
      renderAds();
    }
    if(e.key === 'pressclub_isPayer'){
      renderAds();
    }
  });

  // Initial render after DOM is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', renderAds);
  } else {
    renderAds();
  }
})();
// ======================================
// PRESSCLUB DISPLAY ADS
// Real clickable sponsored banners
// Supports pay-per-view ads API (Roku compatible)
// ======================================
(function(){
  // ------------------------------------------------------------------
  // Ad config - add/edit sponsored ads here
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Pay-per-view Ads API config
  // ------------------------------------------------------------------
  const ADDS_API_CONFIG = {
    // API endpoint for pay-per-view ads (Roku compatible)
    endpoint: 'https://ads.presclub.io/v1/ads',
    // API key for authentication (set in .env or Render dashboard)
    apiKey: process.env.ADS_API_KEY || '',
    // Whether API is enabled
    enabled: process.env.ENABLE_ADS_API === 'true',
    // Fallback to local ads when API fails
    fallbackToLocal: true
  };

  // Small deterministic string hash so ads rotate daily
  function hashString(str){
    let hash = 0;
    for(let i = 0; i < str.length; i++){
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Rotate the library based on the day so the same ad isn't always first
  function getAdsForDay(){
    const day = new Date().toISOString().split('T')[0];
    const start = hashString(day) % AD_LIBRARY.length;
    return AD_LIBRARY.slice(start).concat(AD_LIBRARY.slice(0, start));
  }

  function isAdFree(){
    try{
      // Payers can enable ad-free mode from the dashboard
      const phone = localStorage.getItem('pressclub_phone') || '';
      const key = phone ? `pressclub_adfree_${phone}` : 'pressclub_adfree';
      return localStorage.getItem(key) === '1';
    }catch(err){
      return false;
    }
  }

  // Load ads from API with fallback to local ads
  async function loadAdsFromAPI(){
    if(!ADDS_API_CONFIG.enabled || !ADDS_API_CONFIG.apiKey) return null;
    
    try{
      const resp = await fetch(ADDS_API_CONFIG.endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADDS_API_CONFIG.apiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if(!resp.ok) throw new Error('API request failed');
      
      const data = await resp.json();
      // Return ads data from API, or null if no ads available
      return data.ads || null;
    }catch(err){
      console.error('Failed to load ads from API:', err.message);
      return null;
    }
  }

  function renderAds(){
    // If payer has ad-free enabled, keep ads hidden
    if(isAdFree()){
      document.querySelectorAll('[data-ad], .ad-placeholder, .ad-slot').forEach(el => {
        el.hidden = true;
        el.style.display = 'none';
      });
      return;
    }

    const slots = document.querySelectorAll('.ad-placeholder[data-ad]');
    if(!slots.length) return;

    // Try to load ads from API first
    const apiAds = await loadAdsFromAPI();
    
    // Use API ads if available and has enough ads, otherwise fall back to local
    const ads = apiAds && apiAds.length >= slots.length ? apiAds : getAdsForDay();

    slots.forEach((slot, index) => {
      const ad = ads[index % ads.length];
      if(!ad) return;

      slot.hidden = false;
      slot.style.display = '';

      // Build the clickable sponsored banner
      slot.innerHTML = `
        <a class="ad-banner" href="${ad.link}" target="_blank" rel="noopener noreferrer sponsored" title="${ad.alt}" data-ad-id="${ad.id}">
          <img src="${ad.image}" alt="${ad.alt}" class="ad-banner__image" width="728" height="90" loading="lazy" />
          <span class="ad-banner__label">${ad.label} · PressClub</span>
        </a>
      `;
    });
  }

  // Track ad impression for payment
  function trackAdImpression(adId){
    if(!ADDS_API_CONFIG.enabled || !ADDS_API_CONFIG.apiKey) return;
    
    try{
      fetch(ADDS_API_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADDS_API_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'impression',
          adId: adId,
          timestamp: new Date().toISOString(),
          userId: localStorage.getItem('pressclub_phone') || 'anonymous'
        })
      }).catch(err => console.error('Failed to track ad impression:', err.message));
    }catch(err){
      console.error('Failed to track ad impression:', err.message);
    }
  }

  // Re-render if ad-free mode changes in another tab
  window.addEventListener('storage', (e) => {
    if(e.key && e.key.indexOf('pressclub_adfree') !== -1){
      renderAds();
    }
    if(e.key === 'pressclub_isPayer'){
      renderAds();
    }
  });

  // Initial render after DOM is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', renderAds);
  } else {
    renderAds();
  }
})();
