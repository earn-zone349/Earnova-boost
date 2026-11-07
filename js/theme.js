// Light / dark switch. First visit = LIGHT. The choice is remembered on this device.
(function () {
  var KEY = 'bx_theme', root = document.documentElement;
  function saved() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function current() { return root.getAttribute('data-theme') || 'light'; }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#131a2e' : '#4f46e5');
    var b = document.getElementById('themeBtn');
    if (b) { b.textContent = t === 'dark' ? '☀️' : '🌙'; b.setAttribute('aria-label', t === 'dark' ? 'লাইট মোড' : 'ডার্ক মোড'); b.title = b.getAttribute('aria-label'); }
  }
  root.setAttribute('data-theme', saved() || 'light');   // runs in <head>, before the page paints
  document.addEventListener('DOMContentLoaded', function () {
    apply(current());
    var b = document.getElementById('themeBtn');
    if (b) b.addEventListener('click', function () {
      var t = current() === 'dark' ? 'light' : 'dark'; apply(t);
      try { localStorage.setItem(KEY, t); } catch (e) {}
    });
  });
})();
