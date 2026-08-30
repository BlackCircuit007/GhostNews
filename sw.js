// Monetag push-notification service worker.
// MUST live at the site root as "sw.js" (the browser registers /sw.js).
// Values below come from the Monetag dashboard (Push Notifications zone).
self.options = {
    "domain": "5gvci.com",
    "zoneId": 11687727
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')