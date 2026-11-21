/* Ads — banners / native in sandboxed frames; social bar + popunder with a strict show-schedule */
(function () {
  'use strict';
  var C = window.ADS || {};
  var ON = C.enabled !== false;
  var PREVIEW = /[?&]adpreview=1(?:&|$)/.test(location.search);
  var banner = C.banner || {}, native = C.native || {};
  var loadedScripts = false;

  function code(name) { return String(banner[name] || native[name] || '').trim(); }
  function isNative(name) { return Object.prototype.hasOwnProperty.call(native, name); }

  /* HTML for one slot (empty string when there is no code, unless ?adpreview=1) */
  function slot(name) {
    if (!ON || !/^[a-z_]+$/.test(name)) return '';
    if (!code(name) && !PREVIEW) return '';
    return '<div class="adslot ' + (isNative(name) ? 'native ' : '') + 'ad-' + name + '" data-slot="' + name + '"><span class="adlbl">বিজ্ঞাপন</span><div class="adbox"></div></div>';
  }

  /* fill every empty slot inside root with a sandboxed frame */
  function mount(root) {
    if (!ON) return;
    var list = (root || document).querySelectorAll('.adslot:not([data-done])');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], name = el.getAttribute('data-slot'), snip = code(name), box = el.querySelector('.adbox');
      el.setAttribute('data-done', '1');
      if (!snip) { box.classList.add('ph'); box.textContent = '[বিজ্ঞাপনের জায়গা: ' + name + ']'; continue; }
      var w = /['"]?width['"]?\s*:\s*(\d{2,4})/.exec(snip), h = /['"]?height['"]?\s*:\s*(\d{2,4})/.exec(snip);
      var nat = isNative(name);
      var width = nat ? 0 : (w ? +w[1] : 300), height = nat ? (+C.nativeHeight || 300) : (h ? +h[1] : 250);
      var f = document.createElement('iframe');
      /* no allow-same-origin: the ad can never read this site's storage / login session; no top-navigation: it can't redirect the page */
      f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('title', 'বিজ্ঞাপন');
      f.setAttribute('scrolling', 'no');
      f.setAttribute('loading', 'lazy');
      f.style.width = nat ? '100%' : width + 'px';
      f.style.height = height + 'px';
      f.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>' + snip + '</body></html>';
      box.appendChild(f);
    }
  }

  /* ───── Popunder schedule: pop → 1 min quiet → pop → 30 min quiet → repeat ───── */
  var KEY = 'bx_pop', mem = { s: 0, u: 0 };
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v.s === 'number') return v; } catch (e) {} return mem; }
  function write(v) { mem = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function popAllowed() {
    var now = Date.now(), st = read(), gap = +C.popunderGapMs || 60000, rest = +C.popunderRestMs || 1800000;
    if (st.s === 1) { if (now >= st.u) { write({ s: 2, u: now + rest }); return true; } return false; }   // 2nd pop
    if (st.s === 2) { if (now >= st.u) { write({ s: 1, u: now + gap }); return true; } return false; }   // rest over → new cycle, 1st pop
    write({ s: 1, u: now + gap }); return true;                                                           // very first pop
  }
  function installGate() {
    var orig = window.open;
    var dummy = function () { return { closed: false, focus: function () {}, blur: function () {}, close: function () {}, location: {}, document: { write: function () {}, close: function () {} } }; };
    window.open = function (url) {
      var external = true;
      try { external = !url || new URL(url, location.href).origin !== location.origin; } catch (e) {}
      if (!external || popAllowed()) return orig.apply(window, arguments);
      return dummy();
    };
  }

  function srcOf(s) {
    var m = /<script[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(String(s || ''));
    if (!m) return '';
    var u = m[1].trim(); if (u.indexOf('//') === 0) u = 'https:' + u;
    return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
  }
  function inject(u) { var s = document.createElement('script'); s.src = u; s.async = true; document.body.appendChild(s); loadedScripts = true; }

  /* call once after we know whether a user is logged in */
  function init(loggedIn) {
    if (!ON) return;
    if (loggedIn && C.scriptAdsForLoggedIn !== true) return;
    var pop = srcOf(C.popunder), bar = srcOf(C.socialBar);
    if (pop) { installGate(); inject(pop); }
    if (bar) inject(bar);
  }
  /* a visitor just logged in: scripts that were loaded for guests must not stay on a logged-in page → reload clean */
  function onLogin() {
    if (loadedScripts && C.scriptAdsForLoggedIn !== true) { location.reload(); return true; }
    return false;
  }

  window.BX = window.BX || {};
  window.BX.ads = { slot: slot, mount: mount, init: init, onLogin: onLogin };
})();
