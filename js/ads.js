/* Ads loader — শুধু ইউজার সাইটে (index.html) লোড হয়। admin.html এ এটা নেই। */
(function () {
  'use strict';
  const C = window.ADS_CONFIG || {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const DEFAULT_SIZE = { top: [728, 90], bottom: [728, 90], sidebar: [300, 250] };
  const frames = new Map();
  let uid = 0;

  if (C.enabled === false) {
    window.BXAds = { mount(root) { (root || document).querySelectorAll('.adslot').forEach((s) => s.remove()); } };
    return;
  }

  /* কোডে শুধু URL দিলেও যেন চলে */
  function asHtml(s) {
    s = str(s);
    if (/^(https?:)?\/\/\S+$/i.test(s)) return '<script async data-cfasync="false" src="' + s.replace(/"/g, '&quot;') + '"><\/script>';
    return s;
  }
  /* innerHTML দিয়ে বসালে <script> চলে না — তাই নতুন করে বানিয়ে বসাই */
  function injectSnippet(html, parent) {
    const t = document.createElement('template'); t.innerHTML = html;
    Array.from(t.content.childNodes).forEach((n) => {
      if (n.nodeName === 'SCRIPT') {
        const s = document.createElement('script');
        Array.from(n.attributes).forEach((a) => s.setAttribute(a.name, a.value));
        s.text = n.textContent; parent.appendChild(s);
      } else parent.appendChild(n.cloneNode(true));
    });
  }

  /* ───────── ব্যানার / নেটিভ: আলাদা sandbox iframe এ (নিরাপত্তার জন্য) ───────── */
  function frameDoc(id, html) {
    return '<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{display:flex;justify-content:center}</style></head><body>' +
      html + '<script>(function(){function r(){parent.postMessage({bxad:' + id + ',h:document.documentElement.scrollHeight},"*")}try{new ResizeObserver(r).observe(document.body)}catch(e){}addEventListener("load",r);setInterval(r,2000);r()})()<\/script></body></html>';
  }
  function sizeOf(html, key, dataSize) {
    const w = /['"]?width['"]?\s*[:=]\s*['"]?(\d{2,4})/i.exec(html), h = /['"]?height['"]?\s*[:=]\s*['"]?(\d{2,4})/i.exec(html);
    if (w && h) return [Number(w[1]), Number(h[1])];
    const m = /^(\d+)x(\d+)$/.exec(dataSize || '');
    if (m) return [Number(m[1]), Number(m[2])];
    return DEFAULT_SIZE[key] || [300, 250];
  }
  function fit(rec) {
    if (rec.native) return;
    const avail = rec.slot.clientWidth || rec.w, sc = Math.min(1, avail / rec.w);
    rec.el.style.transform = 'scale(' + sc + ')';
    rec.box.style.width = Math.round(rec.w * sc) + 'px'; rec.box.style.height = Math.round(rec.h * sc) + 'px';
  }
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || typeof d.bxad !== 'number') return;
    const rec = frames.get(d.bxad); if (!rec || e.source !== rec.el.contentWindow || !rec.native) return;
    const h = Math.max(0, Math.min(1500, Number(d.h) || 0)); if (h > 0) rec.el.style.height = h + 'px';
  });
  window.addEventListener('resize', () => frames.forEach((r) => { if (r.slot.isConnected) fit(r); }));

  /* বিজ্ঞাপন না এলে ফাঁকা জায়গা লুকিয়ে দিই (৬, ১৫, ৩০ সেকেন্ড পর দেখি); পরে এলে আবার দেখাই */
  function filled(rec) {
    try {
      const d = rec.el.contentDocument; if (!d || !d.body) return true;
      return Array.from(d.body.querySelectorAll('iframe,img,canvas,ins,video,a,div,svg')).some((n) => n.offsetWidth > 20 && n.offsetHeight > 20);
    } catch (e) { return true; }
  }
  function watch(rec) {
    [6000, 15000, 30000].forEach((ms) => setTimeout(() => {
      if (!rec.slot.isConnected) return;
      const ok = filled(rec);
      rec.slot.style.display = ok ? '' : 'none';
      if (!ok && ms === 30000) console.warn('[BXAds] কোনো বিজ্ঞাপন লোড হয়নি:', rec.path);
    }, ms));
  }

  function mountOne(slot) {
    if (slot.dataset.done) return;
    if (!slot.getClientRects().length) return;                 // লুকানো জায়গায় (যেমন মোবাইলে সাইডবার) বিজ্ঞাপন লোড করব না
    slot.dataset.done = '1';
    const path = slot.dataset.ad || '', parts = path.split('.'), key = parts[parts.length - 1];
    const raw = parts.length === 1 ? C[parts[0]] : ((C.pages || {})[parts[0]] || {})[parts[1]];
    const code = str(raw), isLink = key === 'link', isNative = key === 'native';

    if (!code) {
      if (C.showPlaceholders === false) { slot.remove(); return; }
      const sz = isLink ? [728, 60] : isNative ? [728, 120] : (DEFAULT_SIZE[key] || [300, 250]);
      slot.innerHTML = '<div class="adph" style="max-width:' + sz[0] + 'px;min-height:' + sz[1] + 'px">বিজ্ঞাপনের জায়গা · ' + path + (isNative || isLink ? '' : ' · ' + sz[0] + '×' + sz[1]) + '</div>';
      return;
    }
    if (isLink) {
      if (!/^https:\/\//i.test(code)) { slot.remove(); return; }
      slot.innerHTML = '<div class="adlbl">স্পনসর্ড</div>';
      const a = document.createElement('a');
      a.className = 'adlinkcard'; a.href = code; a.target = '_blank'; a.rel = 'sponsored nofollow noopener noreferrer';
      a.innerHTML = '<img class="giftimg" src="images/gift.png" alt="" width="44" height="44" data-fb="🎁"><span class="grow"><b></b><span class="small muted" style="display:block">স্পনসর্ড লিংক</span></span><span class="btn sm">দেখুন →</span>';
      a.querySelector('b').textContent = str(C.linkTitle) || 'বিশেষ অফার দেখুন';
      slot.appendChild(a); return;
    }
    const html = asHtml(code), id = ++uid, sz = isNative ? [0, 160] : sizeOf(html, key, slot.dataset.size);
    const box = document.createElement('div'); box.className = 'adbox';
    const el = document.createElement('iframe');
    /* same-origin রাখি (নইলে বিজ্ঞাপন ফাঁকা থাকে), কিন্তু ক্লিক ছাড়া পুরো সাইট অন্য পেজে সরিয়ে নেওয়া (redirect) আটকাই।
       পুরো বন্ধ করতে ads-config.js এ sandboxBanners: false দাও। */
    if (C.sandboxBanners !== false) el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    el.setAttribute('scrolling', 'no'); el.setAttribute('title', 'বিজ্ঞাপন');
    if (isNative) { box.style.width = '100%'; el.style.width = '100%'; el.style.height = sz[1] + 'px'; }
    else { el.style.width = sz[0] + 'px'; el.style.height = sz[1] + 'px'; }
    el.srcdoc = frameDoc(id, html);
    box.appendChild(el);
    const lbl = document.createElement('div'); lbl.className = 'adlbl'; lbl.textContent = 'বিজ্ঞাপন';
    slot.appendChild(lbl); slot.appendChild(box);
    const rec = { el, box, slot, path, w: sz[0], h: sz[1], native: isNative };
    frames.set(id, rec); fit(rec); watch(rec);
  }
  function mount(root) {
    try {
      (root || document).querySelectorAll('.adslot').forEach((s) => { try { mountOne(s); } catch (e) { console.warn('[BXAds] স্লট বাদ:', e); } });
    } catch (e) { console.warn('[BXAds]', e); }
  }

  /* ───────── Social Bar: পুরো সাইটে একবার ───────── */
  function startSocialBar() { try { const s = asHtml(C.socialBar); if (s) injectSnippet(s, document.body); } catch (e) { console.warn('[BXAds] social bar', e); } }

  /* ───────── Popunder: সময়ের নিয়ম ─────────
     ক্লিক ১ → পপ (১ম) → gap1 বন্ধ → ক্লিক → পপ (২য়) → gap2 বন্ধ → আবার ১ম
     সময় localStorage এ থাকে, তাই পেজ বদলালে/রিলোড দিলেও নিয়ম ঠিক থাকে। */
  const KEY = 'bx_pop_v1', GAP1 = (Number(C.popunderGap1) || 60) * 1000, GAP2 = (Number(C.popunderGap2) || 1800) * 1000;
  const TYPES = /^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend)$/;
  let armed = false, ready = false, rec = [], scriptEl = null, patchTimer = null, origAdd = null;

  function getState() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.n === 'number' && typeof s.t === 'number') return s; } catch (e) {} return { n: 0, t: 0 }; }
  function setState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function waitMs() {
    const s = getState(), now = Date.now();
    if (s.n <= 0) return 0;
    const gap = s.n === 1 ? GAP1 : GAP2;
    if (s.t > now) return gap;                                   // ঘড়ি উল্টাপাল্টা হলে নিরাপদ দিকে থাকি
    return Math.max(0, s.t + gap - now);
  }
  function unpatch() { if (origAdd) { EventTarget.prototype.addEventListener = origAdd; origAdd = null; } clearTimeout(patchTimer); }
  function neutralize() {
    rec.forEach((r) => { try { r[0].removeEventListener(r[1], r[2], r[3]); } catch (e) {} });
    rec = [];
    ['onclick', 'onmousedown', 'onmouseup'].forEach((p) => { try { document[p] = null; if (document.body) document.body[p] = null; window[p] = null; } catch (e) {} });
    if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
    scriptEl = null; armed = false; ready = false; unpatch();
  }
  function scheduleArm() { setTimeout(arm, waitMs() + 300); }
  function arm() {
    if (armed) return;
    const w = waitMs(); if (w > 0) { setTimeout(arm, w + 300); return; }
    const html = asHtml(C.popunder); if (!html) return;
    armed = true; ready = false;
    /* স্ক্রিপ্ট যে ক্লিক-লিসনার বসায় সেগুলো ধরে রাখি, যাতে সময় না হলে সরিয়ে দিতে পারি */
    origAdd = EventTarget.prototype.addEventListener;
    const orig = origAdd;
    EventTarget.prototype.addEventListener = function (t, f, o) {
      try { if (TYPES.test(t) && f !== onClick && (this === document || this === window || this === document.body || this === document.documentElement)) rec.push([this, t, f, o]); } catch (e) {}
      return orig.call(this, t, f, o);
    };
    patchTimer = setTimeout(unpatch, 12000);
    const before = document.body.querySelectorAll('script').length;
    injectSnippet(html, document.body);
    const all = document.body.querySelectorAll('script'); scriptEl = all.length > before ? all[all.length - 1] : null;
    const done = () => { ready = true; };
    if (scriptEl && scriptEl.src) { scriptEl.addEventListener('load', done); scriptEl.addEventListener('error', () => { neutralize(); setTimeout(arm, 60000); }); } else done();
  }
  function onClick(e) {
    if (!armed || !ready || e.isTrusted === false) return;
    const w = waitMs();
    if (w > 0) { neutralize(); setTimeout(arm, w + 300); return; }      // অন্য ট্যাবে আগেই পপ হয়ে গেছে
    const s = getState();
    setState({ n: s.n === 1 ? 2 : 1, t: Date.now() });                 // এই ক্লিকেই পপ হবে
    setTimeout(() => { neutralize(); scheduleArm(); }, 80);
  }
  window.addEventListener('click', onClick, true);

  function start() { startSocialBar(); try { if (str(C.popunder)) arm(); } catch (e) { console.warn('[BXAds] popunder', e); } }
  if (document.readyState === 'complete') setTimeout(start, 300); else window.addEventListener('load', () => setTimeout(start, 300));

  window.BXAds = { mount };
})();
