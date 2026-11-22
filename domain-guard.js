/* StudyLeem domain lock.
   The site and its study material only display on the domains below. On any other domain (mirror, proxy,
   iframe embed, copied HTML) the page is blanked and the visitor is sent to the real site.
   To add a domain later (e.g. a custom domain) add it to ALLOWED here AND to HOST_OK in firebase-client.js. */
(function () {
  'use strict';
  var ALLOWED = ['studyleem.vercel.app', 'localhost', '127.0.0.1'];
  var HOME = 'https://studyleem.vercel.app';
  function ok(h) { return ALLOWED.indexOf(String(h || '').toLowerCase()) >= 0; }
  window.SL_DOMAIN_OK = ok(location.hostname);
  if (window.SL_DOMAIN_OK) {
    // also refuse to run inside someone else's iframe
    try { if (window.top !== window.self && !ok(window.top.location.hostname)) throw 0; } catch (e) {
      if (window.top !== window.self) { window.SL_DOMAIN_OK = false; }
    }
  }
  if (window.SL_DOMAIN_OK) return;
  try { window.stop(); } catch (_) {}
  var go = HOME + (location.pathname || '/') ;
  var blank = function () {
    var r = document.documentElement;
    r.innerHTML = '<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>StudyLeem</title></head>' +
      '<body style="font-family:Arial,sans-serif;text-align:center;padding:3rem 1rem;color:#0f172a">' +
      '<h1>This page is only available on StudyLeem</h1><p><a href="' + HOME + '">Open studyleem.vercel.app</a></p></body>';
  };
  blank();
  try { (window.top !== window.self ? window.top : window).location.replace(go); } catch (_) { try { window.location.replace(go); } catch (e) {} }
  throw new Error('StudyLeem: this domain is not allowed');
})();
