// ======================================
// PRESSCLUB DISPLAY ADS
// Real clickable sponsored banners
// Supports pay-per-view ads API (server-side configured)
// ======================================
(function(){
  'use strict';

  // ------------------------------------------------------------------
  // Local ad library (used as fallback when ad API is unavailable)
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
  // Server-fetched ad configuration (API key stays server-side)
  // ------------------------------------------------------------------
  let adConfig = { enabled: false, fallbackToLocal: true, endpoint: '/api/ads' };

  async function loadAdConfig(){
    try{
      const resp = await fetch('/api/config');
      if(!resp.ok) throw new Error('Config fetch failed');
      const data = await resp.json();
      adConfig = {
        enabled: data.adsApiEnabled === true,
        fallbackToLocal: data.adsApiFallbackToLocal !== false,
        endpoint: data.adsApiEndpoint || '/api/ads'
      };
    }catch(err){
      console.warn('Ad config fetch failed, using local ads only:', err.message);
    }
  }

  // ------------------------------------------------------------------
  // Small deterministic string hash so ads rotate daily
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Check if the current user has ad-free mode enabled
  // ------------------------------------------------------------------
  function isAdFree(){
    try{
      const phone = localStorage.getItem('pressclub_phone') || '';
      const key = phone ? `pressclub_adfree_${phone}` : 'pressclub_adfree';
      return localStorage.getItem(key) === '1';
    }catch(err){
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Load ads from the server API
  // ------------------------------------------------------------------
  async function loadAdsFromAPI(){
    if(!adConfig.enabled) return null;
    try{
      const resp = await fetch(adConfig.endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if(!resp.ok) throw new Error('Ad API request failed');
      const data = await resp.json();
      return data.ads || null;
    }catch(err){
      console.warn('Failed to load ads from API:', err.message);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Track an ad impression for pay-per-view revenue
  // ------------------------------------------------------------------
  function trackAdImpression(adId, userId){
    if(!adConfig.enabled) return;
    try{
      fetch('/api/ads/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId: adId,
          userId: userId || 'anonymous',
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error('Failed to track ad impression:', err.message));
    }catch(err){
      console.error('Failed to track ad impression:', err.message);
    }
  }

  // ------------------------------------------------------------------
  // Render ads into placeholder slots
  // ------------------------------------------------------------------
  async function renderAds(){
    if(isAdFree()){
      document.querySelectorAll('[data-ad], .ad-placeholder, .ad-slot').forEach(el => {
        el.hidden = true;
        el.style.display = 'none';
      });
      return;
    }

    const slots = document.querySelectorAll('.ad-placeholder[data-ad]');
    if(!slots.length) return;

    // Try the server-side ad API first
    let apiAds = null;
    try{ apiAds = await loadAdsFromAPI(); }catch(e){ /* ignore */ }

    const ads = (apiAds && apiAds.length >= slots.length) ? apiAds : getAdsForDay();

    const phone = localStorage.getItem('pressclub_phone') || '';

    slots.forEach((slot, index) => {
      const ad = ads[index % ads.length];
      if(!ad) return;

      slot.hidden = false;
      slot.style.display = '';

      slot.innerHTML = `
        <a class="ad-banner" href="${ad.link}" target="_blank" rel="noopener noreferrer sponsored" title="${ad.alt}" data-ad-id="${ad.id}">
          <img src="${ad.image}" alt="${ad.alt}" class="ad-banner__image" width="728" height="90" loading="lazy" />
          <span class="ad-banner__label">${ad.label} · PressClub</span>
        </a>
      `;

      // Track impression once per ad slot per page load
      trackAdImpression(ad.id, phone);
    });
  }

  // ------------------------------------------------------------------
  // Re-render if ad-free mode or payer status changes in another tab
  // ------------------------------------------------------------------
  window.addEventListener('storage', (e) => {
    if(e.key && e.key.indexOf('pressclub_adfree') !== -1){ renderAds(); }
    if(e.key === 'pressclub_isPayer'){ renderAds(); }
  });

  // ------------------------------------------------------------------
  // Initialise: fetch config then render
  // ------------------------------------------------------------------
  (async function initAds(){
    await loadAdConfig();
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', renderAds);
    }else{
      renderAds();
    }
  })();

})();
