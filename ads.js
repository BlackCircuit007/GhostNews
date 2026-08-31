// ======================================
// PRESSCLUB ADS — MONETAG ONLY
// The Monetag multi-tag script (monetag.js) injects its own formats on
// every page, so there are no sample banner ads anymore. This file now
// only manages the ad-free preference (payers may opt out in their
// dashboard; ads stay ON by default so the site keeps earning) and
// exposes a small helper API for other scripts.
// ======================================
(function(){
  'use strict';

  function isAdFree(){
    try{
      const phone = localStorage.getItem('pressclub_phone') || '';
      const key = phone ? ('pressclub_adfree_' + phone) : 'pressclub_adfree';
      return localStorage.getItem(key) === '1';
    }catch(err){
      return false;
    }
  }

  function setAdFree(on){
    try{
      const phone = localStorage.getItem('pressclub_phone') || '';
      const key = phone ? ('pressclub_adfree_' + phone) : 'pressclub_adfree';
      localStorage.setItem(key, on ? '1' : '0');
    }catch(err){ /* storage unavailable */ }
    // Tell the Monetag loader to stop/tear down and hide placeholders.
    if(window.__pressclubSetAdFree) window.__pressclubSetAdFree(on);
    applyAdFreeMode();
  }

  function applyAdFreeMode(){
    const off = isAdFree();
    document.body.classList.toggle('ad-free-mode', off);
    document.querySelectorAll('[data-ad], .ad-placeholder, .ad-slot').forEach(function(el){
      if(off){ el.hidden = true; el.style.display = 'none'; }
      else { el.hidden = false; el.style.display = ''; }
    });
  }

  // React to the dashboard toggle and to changes in other tabs
  window.addEventListener('storage', function(e){
    if(!e.key || e.key.indexOf('pressclub_adfree') !== -1){ applyAdFreeMode(); }
  });

  // Small helper API for other scripts
  window.PressClubAds = { isAdFree: isAdFree, setAdFree: setAdFree, applyAdFreeMode: applyAdFreeMode };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyAdFreeMode);
  }else{
    applyAdFreeMode();
  }
})();
