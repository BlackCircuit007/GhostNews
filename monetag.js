// Monetag integration loader.
// - Injects the Monetag multi-tag script (popunder / push / vignette /
//   interstitial) on EVERY page so the owner earns on all traffic,
//   not just the home page.
// - The zone id comes from the server (/api/config) so it can be
//   changed via the MONETAG_ZONE_ID environment variable without
//   editing any HTML.
// - Counts each monetized page view as an ad impression so /stats.html
//   shows how many paid views were served.
(function(){
  'use strict';
  if(window.__pressclubMonetagLoaded) return;
  window.__pressclubMonetagLoaded = true;

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

  fetch('/api/config')
    .then(function(r){ return r.json(); })
    .then(function(cfg){
      if(!cfg || !cfg.monetagZone) return; // not configured - stay silent

      // Respect the payer's ad-free preference (dashboard toggle).
      // Same key/lookup as ads.js, evaluated inline so load order
      // between monetag.js and ads.js never matters.
      try{
        var phone = localStorage.getItem('pressclub_phone') || '';
        var adfreeKey = phone ? ('pressclub_adfree_' + phone) : 'pressclub_adfree';
        if(localStorage.getItem(adfreeKey) === '1') return; // payer opted out
      }catch(e){ /* storage unavailable -> show ads (default) */ }

      // Inject the Monetag multi-tag script exactly as Monetag provides it
      var s = document.createElement('script');
      s.src = cfg.monetagTagUrl || 'https://quge5.com/88/tag.min.js';
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      s.setAttribute('data-zone', String(cfg.monetagZone));
      document.head.appendChild(s);

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
})();