/* Shared helpers for index.html and admin.html */
(function () {
  'use strict';
  const C = window.BOOST_CONFIG || {};
  const configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY &&
    !/YOUR-PROJECT/.test(C.SUPABASE_URL) && !/YOUR_ANON/.test(C.SUPABASE_ANON_KEY));
  const sb = (configured && window.supabase)
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // escape EVERYTHING that comes from the database before it goes into HTML
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"'`]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));

  const NF = new Intl.NumberFormat('bn-BD');
  const MF = new Intl.NumberFormat('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const num = (n) => NF.format(Number(n) || 0);
  const money = (n) => '৳' + MF.format(Number(n) || 0);
  const dateFmt = (d) => {
    try { return new Date(d).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  const PLATFORMS = {
    facebook:  { name: 'Facebook',  color: '#1877f2', mark: 'f'  },
    youtube:   { name: 'YouTube',   color: '#e11d1d', mark: '▶'  },
    tiktok:    { name: 'TikTok',    color: '#0f172a', mark: '♪'  },
    instagram: { name: 'Instagram', color: '#d62976', mark: '◎'  },
  };
  const platMark = (p) => {
    const m = PLATFORMS[p] || { color: '#64748b', mark: '?' };
    return `<span class="plat" style="background:${m.color}" aria-hidden="true">${esc(m.mark)}</span>`;
  };

  const STATUS = {
    pending: 'অপেক্ষমাণ', processing: 'চলছে', completed: 'সম্পন্ন',
    partial: 'আংশিক সম্পন্ন', cancelled: 'বাতিল',
    approved: 'অনুমোদিত', rejected: 'বাতিল',
  };
  const statusBadge = (s) => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;

  const ERR = {
    LOGIN_REQUIRED: 'আগে লগইন করুন।',
    ACCOUNT_BLOCKED: 'আপনার অ্যাকাউন্ট বন্ধ করা আছে। সাপোর্টে যোগাযোগ করুন।',
    SERVICE_UNAVAILABLE: 'এই সার্ভিস এখন বন্ধ আছে।',
    BAD_QUANTITY: 'সংখ্যা সার্ভিসের সর্বনিম্ন-সর্বোচ্চ সীমার মধ্যে দিন।',
    BAD_LINK: 'লিংকটি ঠিক নেই। নির্বাচিত প্ল্যাটফর্মের পুরো https:// লিংক দিন।',
    TOO_FAST: 'অনেক দ্রুত অর্ডার হচ্ছে। এক মিনিট পরে আবার চেষ্টা করুন।',
    DUPLICATE_ORDER: 'এই লিংকে এই সার্ভিসের একটা অর্ডার এখনো চলছে। শেষ হলে আবার দিন।',
    BAD_PRICE: 'এই সংখ্যায় অর্ডার করা যাচ্ছে না, সংখ্যা বাড়িয়ে দিন।',
    INSUFFICIENT_BALANCE: 'ব্যালেন্স কম। আগে টাকা জমা দিন।',
    BAD_METHOD: 'পেমেন্ট মাধ্যম ঠিক নেই।',
    BAD_AMOUNT: 'টাকার পরিমাণ ঠিক নেই (সর্বনিম্ন সীমা দেখুন)।',
    BAD_TRX: 'Transaction ID ঠিক নেই (শুধু ইংরেজি অক্ষর ও সংখ্যা, ৬–২০ ঘর)।',
    BAD_SENDER: 'যে নম্বর থেকে টাকা পাঠিয়েছেন সেটা ঠিকভাবে লিখুন।',
    TOO_MANY_PENDING: 'আগের জমার অনুরোধগুলো যাচাই হওয়া পর্যন্ত অপেক্ষা করুন।',
    TRX_ALREADY_USED: 'এই Transaction ID আগেই ব্যবহার হয়েছে।',
    FORBIDDEN: 'এই কাজের অনুমতি নেই।',
    NOT_FOUND: 'পাওয়া যায়নি।',
    ALREADY_REVIEWED: 'এটা আগেই দেখা হয়ে গেছে।',
    ORDER_FINAL: 'শেষ হয়ে যাওয়া অর্ডার আর বদলানো যায় না।',
    BAD_DELIVERED: 'ডেলিভারির সংখ্যা ঠিক নেই (আংশিক হলে মোটের চেয়ে কম হতে হবে)।',
    BAD_STATUS: 'স্ট্যাটাস ঠিক নেই।',
    NOTE_REQUIRED: 'কারণ/নোট লিখতে হবে।',
    CANNOT_BAN_SELF: 'নিজেকে ব্যান করা যায় না।',
  };
  function errMsg(e) {
    const m = String((e && (e.message || e.error_description || e)) || '');
    for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
    if (/Invalid login credentials/i.test(m)) return 'ইমেইল বা পাসওয়ার্ড ভুল।';
    if (/already registered|already been registered/i.test(m)) return 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে। লগইন করুন।';
    if (/Password should be|weak/i.test(m)) return 'পাসওয়ার্ড অন্তত ৮ অক্ষরের দিন।';
    if (/captcha/i.test(m)) return 'নিরাপত্তা যাচাই ব্যর্থ হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।';
    if (/rate limit|too many/i.test(m)) return 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার করুন।';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'ইন্টারনেট সংযোগে সমস্যা। আবার চেষ্টা করুন।';
    return 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';
  }

  // toast
  function toast(msg, kind) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // modal (content is built by the caller with esc())
  let _modal = null, _prevFocus = null;
  function closeModal() {
    if (_modal) { _modal.remove(); _modal = null; }
    document.removeEventListener('keydown', _esc);
    if (_prevFocus && _prevFocus.focus) { try { _prevFocus.focus(); } catch (e) {} }
  }
  function _esc(e) { if (e.key === 'Escape') closeModal(); }
  function openModal(html) {
    closeModal();
    _prevFocus = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="x" aria-label="বন্ধ" data-close>×</button>${html}</div>`;
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
    document.body.appendChild(ov);
    document.addEventListener('keydown', _esc);
    _modal = ov;
    const first = ov.querySelector('input,select,button:not(.x)');
    if (first) setTimeout(() => first.focus(), 30);
    return ov;
  }

  // button busy state
  async function busy(btn, fn) {
    if (!btn || btn.disabled) return;
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  // safe external link: only real https links become clickable
  const safeHref = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(u || '') ? u : '');
  const linkHtml = (u) => {
    const h = safeHref(u);
    return h ? `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer nofollow">${esc(u)}</a>` : esc(u);
  };

  // Turnstile (bot check) — only if a site key is configured
  let _tsLoaded = null;
  function loadTurnstile() {
    if (!C.TURNSTILE_SITE_KEY) return Promise.resolve(false);
    if (_tsLoaded) return _tsLoaded;
    _tsLoaded = new Promise((res) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
    return _tsLoaded;
  }
  async function renderCaptcha(el) {
    if (!el || !C.TURNSTILE_SITE_KEY) return { token: () => undefined, reset() {} };
    await loadTurnstile();
    let tok = '', id = null;
    if (window.turnstile) id = window.turnstile.render(el, { sitekey: C.TURNSTILE_SITE_KEY, callback: (t) => { tok = t; }, 'expired-callback': () => { tok = ''; } });
    return { token: () => tok || undefined, reset() { tok = ''; try { window.turnstile.reset(id); } catch (e) {} } };
  }

  // login / register / forgot-password window (shared by user site and admin page)
  function authModal(onDone, startTab) {
    const ov = openModal(`
      <h2 style="margin-top:0">স্বাগতম</h2>
      <div class="tabs2"><button data-tab="in" class="on" type="button">লগইন</button><button data-tab="up" type="button">রেজিস্টার</button></div>
      <form id="authForm" novalidate>
        <div id="upOnly" class="hide">
          <label class="f" for="aName">আপনার নাম</label><input class="in" id="aName" autocomplete="name" maxlength="80">
          <label class="f" for="aPhone">মোবাইল নম্বর</label><input class="in" id="aPhone" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="01XXXXXXXXX">
        </div>
        <label class="f" for="aEmail">ইমেইল</label><input class="in" id="aEmail" type="email" autocomplete="email" maxlength="120">
        <label class="f" for="aPass">পাসওয়ার্ড</label><input class="in" id="aPass" type="password" autocomplete="current-password" minlength="8" maxlength="72">
        <div class="hint" id="aPassHint"></div>
        <div id="aCaptcha" style="margin-top:10px"></div>
        <div class="err" id="aErr" role="alert"></div>
        <button class="btn block" id="aGo" type="submit" style="margin-top:8px">লগইন</button>
        <div class="center small" style="margin-top:12px"><a href="#" id="aForgot">পাসওয়ার্ড ভুলে গেছেন?</a></div>
      </form>`);
    let tab = startTab === 'up' ? 'up' : 'in';
    const f = $('#authForm', ov);
    const cap = { c: null };
    renderCaptcha($('#aCaptcha', ov)).then((c) => { cap.c = c; });
    function setTab(t) {
      tab = t;
      $$('.tabs2 button', ov).forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
      $('#upOnly', ov).classList.toggle('hide', t !== 'up');
      $('#aGo', ov).textContent = t === 'up' ? 'রেজিস্টার করুন' : 'লগইন';
      $('#aPass', ov).autocomplete = t === 'up' ? 'new-password' : 'current-password';
      $('#aPassHint', ov).textContent = t === 'up' ? 'অন্তত ৮ অক্ষরের পাসওয়ার্ড দিন।' : '';
      $('#aForgot', ov).classList.toggle('hide', t === 'up');
      $('#aErr', ov).textContent = '';
    }
    setTab(tab);
    $$('.tabs2 button', ov).forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('#aForgot', ov).addEventListener('click', async (e) => {
      e.preventDefault();
      const email = $('#aEmail', ov).value.trim();
      if (!email) { $('#aErr', ov).textContent = 'আগে ইমেইল লিখুন, তারপর এখানে চাপুন।'; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $('#aErr', ov).style.color = error ? '' : 'var(--ok)';
      $('#aErr', ov).textContent = error ? errMsg(error) : 'ইমেইলে পাসওয়ার্ড বদলানোর লিংক পাঠানো হয়েছে।';
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#aErr', ov); err.style.color = ''; err.textContent = '';
      const email = $('#aEmail', ov).value.trim(), password = $('#aPass', ov).value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'সঠিক ইমেইল দিন।'; return; }
      if (password.length < 8) { err.textContent = 'পাসওয়ার্ড অন্তত ৮ অক্ষরের দিন।'; return; }
      const name = $('#aName', ov).value.trim(), phone = $('#aPhone', ov).value.trim();
      if (tab === 'up') {
        if (name.length < 2) { err.textContent = 'আপনার নাম লিখুন।'; return; }
        if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) { err.textContent = 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন।'; return; }
      }
      const captchaToken = cap.c ? cap.c.token() : undefined;
      if (C.TURNSTILE_SITE_KEY && !captchaToken) { err.textContent = 'নিরাপত্তা যাচাই শেষ হওয়া পর্যন্ত একটু অপেক্ষা করুন।'; return; }
      await busy($('#aGo', ov), async () => {
        const res = tab === 'up'
          ? await sb.auth.signUp({ email, password, options: { data: { full_name: name, phone }, captchaToken } })
          : await sb.auth.signInWithPassword({ email, password, options: { captchaToken } });
        if (res.error) { err.textContent = errMsg(res.error); if (cap.c) cap.c.reset(); return; }
        if (tab === 'up' && !res.data.session) {
          err.style.color = 'var(--ok)';
          err.textContent = 'ইমেইলে একটা যাচাইয়ের লিংক পাঠানো হয়েছে। লিংকে চাপ দিয়ে তারপর লগইন করুন।';
          return;
        }
        closeModal();
        if (onDone) onDone();
      });
    });
    return ov;
  }

  // set-new-password window (after the user clicks the email link)
  function recoveryModal() {
    const ov = openModal(`<h2 style="margin-top:0">নতুন পাসওয়ার্ড</h2>
      <form id="rf"><label class="f" for="rp">নতুন পাসওয়ার্ড</label>
      <input class="in" id="rp" type="password" autocomplete="new-password" minlength="8" maxlength="72">
      <div class="err" id="re"></div><button class="btn block" type="submit" style="margin-top:8px">সেভ করুন</button></form>`);
    $('#rf', ov).addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = $('#rp', ov).value;
      if (p.length < 8) { $('#re', ov).textContent = 'অন্তত ৮ অক্ষর দিন।'; return; }
      const { error } = await sb.auth.updateUser({ password: p });
      if (error) { $('#re', ov).textContent = errMsg(error); return; }
      closeModal(); toast('পাসওয়ার্ড বদলানো হয়েছে।', 'ok');
    });
  }

  function setupMissing() {
    document.body.innerHTML = `<div class="setup card"><h2>সেটআপ বাকি আছে</h2>
      <p>ওয়েবসাইট চালানোর আগে <b>js/config.js</b> ফাইলে Supabase এর <b>URL</b> আর <b>anon key</b> বসাতে হবে।</p>
      <p class="muted small">Supabase → Project Settings → API পেজ থেকে নাও।</p></div>`;
  }

  window.BX = { C, sb, configured, $, $$, esc, num, money, dateFmt, PLATFORMS, platMark, STATUS, statusBadge,
    errMsg, toast, openModal, closeModal, busy, safeHref, linkHtml, authModal, recoveryModal, setupMissing };
})();
