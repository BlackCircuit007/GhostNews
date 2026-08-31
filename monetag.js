// Monetag integration loader.
// - Injects the Monetag multi-tag script (popunder / push / vignette /
//   interstitial) on EVERY page so the owner earns on all traffic,
//   not just the home page.
// - The zone id comes from the server (/api/config) so it can be
//   changed via the MONETAG_ZONE_ID environment variable without
//   editing any HTML.
// - Payers can switch ads OFF (dashboard -> Ad-free). This reflects
//   IMMEDIATELY: it stops injection on page load, and if the payer
//   toggles while a Monetag script is already loaded (same tab or a
//   sibling tab) the already-injected script is removed too.
// - Counts each monetized page view as an ad impression so /stats.html
//   shows how many paid views were served.
(function(){
  'use strict';
  if(window.__pressclubMonetagLoaded) return;
  window.__pressclubMonetagLoaded = true;

  // Global runtime switch. When true, no Monetag code runs / stays.
  // Lives on window so ads.js and the dashboard toggle can reach it.
  window.__pressclubAdsStop = window.__pressclubAdsStop || false;

  // The payer ad-free key must match ads.js/dashboard.js exactly.
  var adfreeKey = null;
  function resolveAdfreeKey(){
    if(adfreeKey) return adfreeKey;
    try{
      var phone = localStorage.getItem('pressclub_phone') || '';
      adfreeKey = phone ? ('pressclub_adfree_' + phone) : 'pressclub_adfree';
    }catch(e){ adfreeKey = 'pressclub_adfree'; }
    return adfreeKey;
  }
  function payerAdFree(){
    try{ return localStorage.getItem(resolveAdfreeKey()) === '1'; }
    catch(e){ return false; }
  }
  function adsBlocked(){ return window.__pressclubAdsStop || payerAdFree(); }

  // Keep a reference to any Monetag script we inject so we can remove it.
  var injectedTag = null;

  // Best-effort removal of everything the Monetag runtime injects.
  function tearDownMonetag(){
    if(injectedTag){
      try{ injectedTag.remove(); }catch(e){}
      injectedTag = null;
    }
    // Remove any child nodes the tag may have dropped in <head>.
    try{
      document.querySelectorAll('script[data-zone]').forEach(function(n){ n.remove(); });
    }catch(e){}
  }

  // Force the ad-free state from the same tab (the dashboard toggle).
  function setAdFree(on){
    window.__pressclubAdsStop = !!on;
    if(window.__pressclubAdsStop) tearDownMonetag();
    if(window.PressClubAds) window.PressClubAds.applyAdFreeMode();
  }

  window.__pressclubSetAdFree = setAdFree;

  // React across tabs: when the payer toggles ad-free anywhere, we
  // immediately tear down any loaded Monetag runtime in THIS tab too.
  window.addEventListener('storage', function(e){
    if(e.key && e.key.indexOf('pressclub_adfree') !== -1){
      window.__pressclubAdsStop = e.newValue === '1';
      if(window.__pressclubAdsStop) tearDownMonetag();
    }
  });

  // Skip entirely when the payer is already ad-free on load.
  if(adsBlocked()) return;

  fetch('/api/config')
    .then(function(r){ return r.json(); })
    .then(function(cfg){
      // Re-check after the async round-trip: the payer may have toggled
      // ad-free (or logged in) while /api/config was resolving.
      if(!cfg || !cfg.monetagZone) return; // not configured - stay silent
      if(adsBlocked()) return;

      // Inject the Monetag multi-tag script exactly as Monetag provides it
      var s = document.createElement('script');
      s.src = cfg.monetagTagUrl || 'https://quge5.com/88/tag.min.js';
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      s.setAttribute('data-zone', String(cfg.monetagZone));
      document.head.appendChild(s);
      injectedTag = s;

      // Track this monetized page view for the owner stats page
      try{
        fetch('/api/ads/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adId: 'monetag-multi-tag',
            userId: getUserId(),
            timestamp: new Date().toISOString()
          })
        }).catch(function(){});
      }catch(e){}
    })
    .catch(function(){ /* ads are optional - never break the page */ });

  // Pseudonymous visitor id - no personal data is collected or sent.
  function getUserId(){
    try{
      var k = 'pc_uid';
      var v = localStorage.getItem(k);
      if(!v){
        v = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(k, v);
      }
      return v;
    }catch(e){ return 'anon'; }
  }
})();