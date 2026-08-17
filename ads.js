// ======================================
// PRESSCLUB DISPLAY ADS
// Real clickable sponsored banners
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

    const ads = getAdsForDay();

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