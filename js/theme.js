// Light / dark switch. First visit = DARK (neon green). The choice is remembered on this device.
(function () {
  var KEY = 'bx_theme', root = document.documentElement;
  /* ছবি না থাকলে (404) আগের কোড-আঁকা আইকন দেখায় — data-fb এ fallback রাখা থাকে */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-fb')) { var fb = t.getAttribute('data-fb'); t.removeAttribute('data-fb'); t.outerHTML = fb; }
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
  });
})();
