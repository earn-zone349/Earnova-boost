// Light / dark switch + image helpers. First visit = DARK (neon green). The choice is remembered on this device.
(function () {
  var KEY = 'bx_theme', root = document.documentElement;

  /* ছবি না থাকলে (404) আগের কোড-আঁকা আইকন দেখায় — data-fb এ fallback রাখা থাকে */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-fb')) { var fb = t.getAttribute('data-fb'); t.removeAttribute('data-fb'); t.outerHTML = fb; }
  }, true);

  /* কালো ব্যাকগ্রাউন্ডের আইকন থেকে বাইরের কালো অংশ স্বচ্ছ করা (ডার্ক ও লাইট দুই মোডেই সুন্দর দেখাতে)।
     শুধু ছবির কিনারা থেকে ছড়ানো কালো অংশ মোছে; ভেতরের কালো (যেমন আইকনের নিজের রং) থাকে। */
  function koPixels(p, w, h) {
    var LIM = 72, LO = 14, HI = 62, n = w * h, seen = new Uint8Array(n), q = new Int32Array(n), qs = 0, qe = 0, i;
    function dark(k) { var o = k * 4, m = p[o] > p[o + 1] ? p[o] : p[o + 1]; if (p[o + 2] > m) m = p[o + 2]; return m < LIM; }
    function add(k) { if (!seen[k] && dark(k)) { seen[k] = 1; q[qe++] = k; } }
    for (i = 0; i < w; i++) { add(i); add((h - 1) * w + i); }
    for (i = 0; i < h; i++) { add(i * w); add(i * w + w - 1); }
    while (qs < qe) {
      var k = q[qs++], x = k % w, y = (k - x) / w;
      if (x > 0) add(k - 1); if (x < w - 1) add(k + 1); if (y > 0) add(k - w); if (y < h - 1) add(k + w);
    }
    for (i = 0; i < qe; i++) {
      var o = q[i] * 4, m = Math.max(p[o], p[o + 1], p[o + 2]);
      var a = m <= LO ? 0 : Math.round((m - LO) / (HI - LO) * 255);
      if (a < p[o + 3]) p[o + 3] = a > 255 ? 255 : a;
    }
    return qe;
  }
  window.__bxKO = koPixels;
  function knockout(im) {
    try {
      var w = im.naturalWidth, h = im.naturalHeight;
      im.setAttribute('data-ko-done', '1');
      if (!w || !h || w * h > 1500 * 1500) return;
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
      var d = x.getImageData(0, 0, w, h);
      if (d.data[3] < 250) return;                       // আগে থেকেই স্বচ্ছ — কিছু করার নেই
      if (koPixels(d.data, w, h) < 50) return;           // কিনারায় কালো নেই
      x.putImageData(d, 0, 0); im.src = c.toDataURL('image/png');
    } catch (e) { /* ব্রাউজার না দিলে আসল ছবিই থাকবে */ }
  }
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-ko') && !t.hasAttribute('data-ko-done')) knockout(t);
  }, true);

  function saved() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function current() { return root.getAttribute('data-theme') || 'dark'; }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#040b0c' : '#14a845');
    var b = document.getElementById('themeBtn');
    if (b) {
      if (b.querySelector('.s')) b.setAttribute('data-t', t); else b.textContent = t === 'dark' ? '☀️' : '🌙';
      b.setAttribute('aria-label', t === 'dark' ? 'লাইট মোডে যান' : 'ডার্ক মোডে যান'); b.title = b.getAttribute('aria-label');
    }
  }
  root.setAttribute('data-theme', saved() || 'dark');   // runs in <head>, before the page paints
  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    var b = document.getElementById('themeBtn');
    if (b) b.addEventListener('click', function () {
      var t = current() === 'dark' ? 'light' : 'dark'; apply(t);
      try { localStorage.setItem(KEY, t); } catch (e) {}
    });
    /* ঐচ্ছিক ব্যাকগ্রাউন্ড ছবি: images/bg.jpg থাকলে শুধু ইউজার সাইটে দেখায়, না থাকলে আগের মতোই */
    if (document.getElementById('hdrRight')) {
      var bg = new Image();
      bg.onload = function () { root.classList.add('has-bg'); };
      bg.src = 'images/bg.jpg';
    }
  });
})();
