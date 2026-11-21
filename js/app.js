/* User site */
(function () {
  'use strict';
  const { sb, configured, $, $$, esc, num, money, dateFmt, PLATFORMS, platMark, statusBadge, errMsg, toast,
          openModal, closeModal, busy, linkHtml, authModal, recoveryModal, setupMissing } = window.BX;
  if (!configured || !sb) { setupMissing(); return; }

  const S = { user: null, profile: null, services: [], settings: {}, filter: 'all', ordFilter: 'all', timer: null, route: 'home', q: '', chartData: null };

  /* বিজ্ঞাপনের জায়গা (কোড বসে js/ads-config.js ফাইলে) */
  const slot = (k, size) => `<div class="adslot" data-ad="${S.route === 'new' ? 'home' : S.route}.${k}"${size ? ` data-size="${size}"` : ''}></div>`;
  const mountAds = () => { if (window.BXAds) window.BXAds.mount($('#view')); };
  /* ছবি: images/<নাম>.png থাকলে সেটা, না থাকলে আগের কোড-আঁকা আইকন (fallback) */
  const img = (name, cls, fb) => /^[\w-]+$/.test(name) ? `<img class="${cls || ''}" src="images/${name}.png" alt="" decoding="async" data-fb="${esc(fb || '')}">` : (fb || '');
  const pmark = (p) => img(p, 'pimg', platMark(p));

  /* ───────────── data ───────────── */
  async function loadSettings() {
    const { data } = await sb.from('settings').select('key,value');
    const o = {}; (data || []).forEach((r) => { o[r.key] = r.value; });
    S.settings = o;
    const name = typeof o.site_name === 'string' && o.site_name ? o.site_name : 'BoostBD';
    $('#brandName').textContent = name; $('#mbrand').textContent = name; document.title = name;
    const sl = typeof o.support_link === 'string' && /^https:\/\//i.test(o.support_link) ? o.support_link : '';
    const ss = $('#sideSupport'); if (ss) { if (sl) { ss.href = sl; ss.classList.remove('hide'); } else ss.classList.add('hide'); }
    $('#footTxt').textContent = '© ' + new Date().getFullYear() + ' ' + name;
  }
  async function loadServices() {
    const { data, error } = await sb.from('services').select('*').eq('active', true).order('sort_order').order('id');
    if (error) throw error;
    S.services = data || [];
  }
  async function loadProfile() {
    const { data: { session } } = await sb.auth.getSession();
    S.user = session ? session.user : null;
    S.profile = null;
    if (S.user) {
      const { data } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
      S.profile = data || null;
    }
    paintHeader();
  }

  async function doLogout() { await sb.auth.signOut(); toast('লগআউট হয়েছে।'); }
  function paintHeader() {
    const r = $('#hdrRight'), out = $('#sideLogout');
    if (out) out.classList.toggle('hide', !S.user);
    if (S.user) {
      const bal = S.profile ? money(S.profile.balance) : '…';
      const nm = (S.profile && S.profile.full_name) || (S.user.email || '').split('@')[0] || 'আমি';
      r.innerHTML = `<a class="uchip" href="#/wallet" title="ওয়ালেট"><span class="av">${esc(Array.from(nm)[0].toUpperCase())}</span><span><span class="nm">${esc(nm)}</span><span class="bl">${esc(bal)}</span></span></a>
        <button class="btn ghost sm mobonly" id="logoutBtn" type="button" style="margin-left:8px">লগআউট</button>`;
      $('#logoutBtn').onclick = doLogout;
    } else {
      r.innerHTML = `<button class="btn ghost sm" id="liBtn" type="button">লগইন</button>
        <button class="btn sm" id="suBtn" type="button" style="margin-left:6px">রেজিস্টার</button>`;
      $('#liBtn').onclick = () => authModal(onAuthed, 'in');
      $('#suBtn').onclick = () => authModal(onAuthed, 'up');
    }
  }
  async function onAuthed() { await loadProfile(); route(); }

  /* ───────────── router ───────────── */
  function route() {
    clearInterval(S.timer); S.timer = null;
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const r = h.startsWith('orders') ? 'orders' : h.startsWith('wallet') ? 'wallet' : h.startsWith('new') ? 'new' : 'home';
    S.route = r;
    $$('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === r));
    if (r !== 'new') window.scrollTo(0, 0);
    if (r === 'orders') return viewOrders();
    if (r === 'wallet') return viewWallet();
    return viewHome().then(() => {
      if (r === 'new') { const e = $('#svcSection'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  window.addEventListener('hashchange', route);

  function needLogin(msgHtml) {
    $('#view').innerHTML = `${slot('top')}<div class="card center sect"><h2>${msgHtml}</h2>
      <p class="muted">এই পেজ দেখতে লগইন বা রেজিস্টার করতে হবে।</p>
      <div class="row" style="justify-content:center"><button class="btn" id="nl1" type="button">লগইন</button>
      <button class="btn ghost" id="nl2" type="button">রেজিস্টার</button></div></div>${slot('bottom')}${slot('link')}`;
    mountAds();
    $('#nl1').onclick = () => authModal(onAuthed, 'in');
    $('#nl2').onclick = () => authModal(onAuthed, 'up');
  }

  /* ───────────── HOME ───────────── */
  async function viewHome() {
    const v = $('#view');
    S.chartData = null;
    const tiles = Object.values(PLATFORMS).slice(0, 4).map((p, i) => `<div class="tile t${i + 1}" style="background:${esc(p.color)}">${esc(p.mark)}</div>`).join('');
    v.innerHTML = `<section class="hero2" id="hero"><div class="txt">
        <h1>সোশ্যাল মিডিয়ায়<br><span class="hl">এগিয়ে যান</span></h1>
        <p>Facebook, YouTube, TikTok ও Instagram এর ফলোয়ার, লাইক ও ভিউ — দাম আগেই দেখুন, নিজের ওয়ালেট থেকে অর্ডার করুন, আর অর্ডারের অগ্রগতি সরাসরি দেখুন।</p>
        <div class="checks"><span>দাম আগেই দেখুন</span><span>নিজের ওয়ালেট থেকে অর্ডার</span><span>অর্ডারের অগ্রগতি সরাসরি</span></div>
        <a class="btn glow" href="#/new">অর্ডার শুরু করুন →</a></div>
        <div class="hero-art" aria-hidden="true"><div class="ring"></div>${tiles}</div></section>
      <div id="noticeBox"></div>
      ${slot('top')}
      <div class="grid g4 sect" id="stats"></div>
      <div class="dash sect">
        <section class="card" id="panelL"></section>
        <section class="card"><div class="ptitle">${img('rocket', 'ptic', '🚀')} জনপ্রিয় সার্ভিস<a class="small" style="margin-left:auto" href="#/new">সব দেখুন →</a></div><div class="qlist" id="qlist"><div class="empty"><span class="spin"></span></div></div></section>
      </div>
      <div class="sect" id="svcSection"><h2>সার্ভিস ও দাম</h2>
        <div class="filters" id="filters"></div>
        <div class="grid g3" id="svcGrid"><div class="empty"><span class="spin"></span></div></div></div>
      ${slot('native')}
      ${slot('bottom')}
      ${slot('link')}
      ${trustHtml()}`;
    mountAds();
    /* ঐচ্ছিক: images/hero.png ফাইল থাকলে হিরো ব্যানারে সেই ছবি দেখাবে */
    const im = new Image();
    im.onload = () => { const h = $('#hero'); if (h) h.classList.add('has-img'); };
    im.src = 'images/hero.png';
    const n = S.settings.notice;
    if (typeof n === 'string' && n.trim()) $('#noticeBox').innerHTML = `<div class="notice">${esc(n)}</div>`;
    paintPanelL();
    try { await loadServices(); } catch (e) { $('#svcGrid').innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; $('#qlist').innerHTML = ''; return; }
    paintQuick(); paintFilters(); paintServices();
    sb.rpc('get_public_stats').then(({ data }) => {
      if (!data || !$('#stats')) return;
      const items = [['মোট অর্ডার', data.orders_total, 'cart', '📦'], ['এখন চলছে', data.orders_active, 'bolt', '⚡'], ['সম্পন্ন অর্ডার', data.orders_completed, 'check', '✅'], ['মোট ডেলিভারি', data.units_delivered, 'rocket', '🚀']];
      $('#stats').innerHTML = items.map(([l, x, nm, ic], i) => `<div class="stat c${i + 1}"><div class="si" aria-hidden="true">${img(nm, '', ic)}</div><div><b>${esc(num(x))}</b><span>${esc(l)}</span></div></div>`).join('');
    });
  }
  function trustHtml() {
    const sup = typeof S.settings.support_link === 'string' && /^https:\/\//i.test(S.settings.support_link);
    const it = [['shield', '🛡️', 'নিজের ওয়ালেট', 'আপনার ব্যালেন্স, আপনার নিয়ন্ত্রণে'], ['bolt', '⚡', 'লাইভ অর্ডার ট্র্যাক', 'অগ্রগতি সরাসরি দেখুন']];
    if (sup) it.push(['headset', '🎧', 'সাপোর্ট', 'সমস্যায় যোগাযোগ করুন']);
    it.push(['diamond', '💎', 'দাম আগেই দেখুন', 'অর্ডারের আগেই মোট দাম']);
    return `<div class="trust sect">${it.map(([n, e, t, s]) => `<div class="ti">${img(n, '', e)}<div><b>${esc(t)}</b><span>${esc(s)}</span></div></div>`).join('')}</div>`;
  }
  function paintQuick() {
    const el = $('#qlist'); if (!el) return;
    el.innerHTML = S.services.slice(0, 5).map((s) => `<a data-qo="${esc(s.id)}" role="button" tabindex="0">${pmark(s.platform)}<span>${esc(s.name)}</span><span class="p">${esc(money(s.price_per_1000))}</span></a>`).join('') || '<div class="empty">এখন কোনো সার্ভিস নেই।</div>';
    $$('[data-qo]').forEach((a) => { a.onclick = () => orderModal(Number(a.dataset.qo)); a.onkeydown = (e) => { if (e.key === 'Enter') orderModal(Number(a.dataset.qo)); }; });
  }
  function paintPanelL() {
    const el = $('#panelL'); if (!el) return;
    if (!S.user) {
      el.innerHTML = `<div class="ptitle">📋 কীভাবে কাজ করে</div><div class="steps">
        <div class="step"><i>১</i><div><b>রেজিস্টার করুন</b><span class="muted small">অ্যাকাউন্ট খুলুন।</span></div></div>
        <div class="step"><i>২</i><div><b>টাকা জমা দিন</b><span class="muted small">ওয়ালেটে ব্যালেন্স যোগ করুন।</span></div></div>
        <div class="step"><i>৩</i><div><b>অর্ডার করুন</b><span class="muted small">লিংক ও পরিমাণ দিন, অগ্রগতি দেখুন।</span></div></div></div>`;
      return;
    }
    el.innerHTML = `<div class="ptitle">📊 আপনার অর্ডার<div class="rng"><button class="on" data-d="7" type="button">৭ দিন</button><button data-d="30" type="button">৩০ দিন</button></div></div><div id="chartBox"><div class="empty"><span class="spin"></span></div></div>`;
    const btns = el.querySelectorAll('.rng button');
    btns.forEach((b) => { b.onclick = () => { btns.forEach((x) => x.classList.toggle('on', x === b)); drawChart(Number(b.dataset.d)); }; });
    drawChart(7);
  }
  async function drawChart(days) {
    const box = $('#chartBox'); if (!box) return;
    if (!S.chartData) {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await sb.from('orders').select('created_at,price').gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
      if (!$('#chartBox')) return;
      if (error) { box.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
      S.chartData = data || [];
    }
    const key = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const list = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); list.push({ d, k: key(d), c: 0 }); }
    const idx = {}; list.forEach((x, i) => { idx[x.k] = i; });
    let total = 0, spend = 0;
    S.chartData.forEach((o) => { const i = idx[key(new Date(o.created_at))]; if (i != null) { list[i].c++; total++; spend += Number(o.price) || 0; } });
    const W = 600, H = 220, L = 34, R = 12, T = 14, B = 28, iw = W - L - R, ih = H - T - B;
    const max = Math.max(1, ...list.map((x) => x.c)), step = Math.ceil(max / 4), top = step * 4;
    const X = (i) => L + (list.length > 1 ? iw * i / (list.length - 1) : iw / 2), Y = (v) => T + ih - ih * v / top;
    const pts = list.map((x, i) => [X(i), Y(x.c)]);
    const line = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    const area = line + ` L${X(list.length - 1).toFixed(1)} ${T + ih} L${X(0).toFixed(1)} ${T + ih} Z`;
    let grid = '';
    for (let k = 0; k <= 4; k++) { const v = step * k, y = Y(v).toFixed(1); grid += `<line class="gr" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${(Number(y) + 4).toFixed(1)}" text-anchor="end">${v}</text>`; }
    const every = Math.ceil(list.length / 7);
    const labels = list.map((x, i) => (i % every === 0 || i === list.length - 1) ? `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${x.d.getDate()}/${x.d.getMonth() + 1}</text>` : '').join('');
    const dots = pts.map((q) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" style="fill:var(--brand)"/>`).join('');
    const lc = list[list.length - 1].c, lx = X(list.length - 1), ly = Y(lc), bx = Math.min(W - 40, Math.max(L + 30, lx)), by = Math.max(2, ly - 32);
    const bubble = `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="6" style="fill:var(--brand);stroke:var(--card);stroke-width:2"/><rect x="${(bx - 30).toFixed(1)}" y="${by.toFixed(1)}" width="60" height="22" rx="11" style="fill:var(--card);stroke:var(--brand);stroke-width:1.5"/><text x="${bx.toFixed(1)}" y="${(by + 15).toFixed(1)}" text-anchor="middle" style="fill:var(--text);font-weight:700;font-size:12px">${esc(num(lc))} আজ</text>`;
    box.innerHTML = `<div class="muted small" style="margin-bottom:6px">${esc(num(total))} টি অর্ডার · ${esc(money(spend))}</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="অর্ডারের চার্ট"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#cg)"/><path class="ln" d="${line}"/>${dots}${labels}${bubble}</svg>`;
  }
  function paintFilters() {
    const present = ['all', ...Object.keys(PLATFORMS).filter((p) => S.services.some((s) => s.platform === p))];
    $('#filters').innerHTML = present.map((p) =>
      `<button class="pill ${S.filter === p ? 'on' : ''}" data-f="${esc(p)}" type="button">${p === 'all' ? 'সব' : esc(PLATFORMS[p].name)}</button>`).join('');
    $$('#filters .pill').forEach((b) => b.onclick = () => { S.filter = b.dataset.f; paintFilters(); paintServices(); });
  }
  function paintServices() {
    const q = (S.q || '').toLowerCase();
    const list = S.services.filter((s) => (S.filter === 'all' || s.platform === S.filter) &&
      (!q || (s.name + ' ' + (s.description || '') + ' ' + ((PLATFORMS[s.platform] || {}).name || '')).toLowerCase().includes(q)));
    if (!list.length) { $('#svcGrid').innerHTML = `<div class="empty">${q ? 'কিছু পাওয়া যায়নি।' : 'এখন কোনো সার্ভিস নেই।'}</div>`; return; }
    $('#svcGrid').innerHTML = list.map((s) => `
      <article class="card svc">
        <div class="row">${pmark(s.platform)}<div class="grow"><h3 style="margin:0">${esc(s.name)}</h3>
          <span class="muted small">${esc((PLATFORMS[s.platform] || {}).name || '')}</span></div></div>
        ${s.description ? `<div class="muted small">${esc(s.description)}</div>` : ''}
        <div class="row"><div class="price grow">${esc(money(s.price_per_1000))} <small>/ প্রতি ১০০০</small></div></div>
        <div class="muted small">সর্বনিম্ন ${esc(num(s.min_qty))} · সর্বোচ্চ ${esc(num(s.max_qty))}</div>
        <button class="btn block" data-order="${esc(s.id)}" type="button">অর্ডার করুন</button>
      </article>`).join('');
    $$('[data-order]').forEach((b) => b.onclick = () => orderModal(Number(b.dataset.order)));
  }

  /* ───────────── ORDER WINDOW ───────────── */
  function orderModal(id) {
    const s = S.services.find((x) => x.id === id); if (!s) return;
    if (!S.user) { authModal(() => onAuthed().then(() => orderModal(id)), 'up'); return; }
    const ov = openModal(`<h2 style="margin-top:0">${esc(s.name)}</h2>
      <div class="muted small">${esc(money(s.price_per_1000))} প্রতি ১০০০ · সর্বনিম্ন ${esc(num(s.min_qty))} · সর্বোচ্চ ${esc(num(s.max_qty))}</div>
      <form id="of" novalidate>
        <label class="f" for="oLink">লিংক</label>
        <input class="in" id="oLink" inputmode="url" autocomplete="off" maxlength="300" placeholder="https://...">
        <div class="hint">${esc((PLATFORMS[s.platform] || {}).name || '')} এর পুরো https:// লিংক দিন। অ্যাকাউন্ট/ভিডিও পাবলিক থাকতে হবে।</div>
        <label class="f" for="oQty">পরিমাণ</label>
        <input class="in" id="oQty" inputmode="numeric" autocomplete="off" placeholder="${esc(s.min_qty)}">
        <div class="card" style="margin-top:14px;padding:12px">
          <div class="row"><span class="muted">মোট দাম</span><span class="grow"></span><b id="oTotal">${esc(money(0))}</b></div>
          <div class="row small muted"><span>আপনার ব্যালেন্স</span><span class="grow"></span><span>${esc(money(S.profile ? S.profile.balance : 0))}</span></div>
        </div>
        <div class="err" id="oErr" role="alert"></div>
        <button class="btn block" id="oGo" type="submit" style="margin-top:6px">অর্ডার নিশ্চিত করুন</button>
        <div class="center small" style="margin-top:10px"><a href="#/wallet" data-close>ব্যালেন্স কম? টাকা জমা দিন</a></div>
      </form>`);
    const qtyEl = $('#oQty', ov), totEl = $('#oTotal', ov), err = $('#oErr', ov);
    const calc = () => { const q = parseInt(qtyEl.value.replace(/\D/g, ''), 10) || 0; return { q, p: Math.round(Number(s.price_per_1000) * q / 1000 * 100) / 100 }; };
    qtyEl.addEventListener('input', () => { totEl.textContent = money(calc().p); });
    $('#of', ov).addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const link = $('#oLink', ov).value.trim(), { q, p } = calc();
      if (!/^https:\/\/\S{4,}$/i.test(link)) { err.textContent = 'পুরো https:// লিংক দিন।'; return; }
      if (q < s.min_qty || q > s.max_qty) { err.textContent = `পরিমাণ ${num(s.min_qty)} থেকে ${num(s.max_qty)} এর মধ্যে দিন।`; return; }
      if (S.profile && p > Number(S.profile.balance)) { err.textContent = 'ব্যালেন্স কম। আগে টাকা জমা দিন।'; return; }
      await busy($('#oGo', ov), async () => {
        const { error } = await sb.rpc('create_order', { p_service: s.id, p_link: link, p_qty: q });
        if (error) { err.textContent = errMsg(error); return; }
        closeModal(); toast('অর্ডার জমা হয়েছে।', 'ok');
        await loadProfile(); location.hash = '#/orders';
      });
    });
  }

  /* ───────────── MY ORDERS ───────────── */
  async function viewOrders() {
    if (!S.user) return needLogin('আপনার অর্ডার');
    $('#view').innerHTML = `${slot('top')}<div class="sect"><div class="row"><h2 class="grow" style="margin:0">আমার অর্ডার</h2>
      <button class="btn ghost sm" id="refresh" type="button">রিফ্রেশ</button></div>
      <div class="filters" id="ordFilters"></div><div id="ordList"><div class="empty"><span class="spin"></span></div></div></div>${slot('native')}${slot('bottom')}${slot('link')}`;
    mountAds();
    $('#refresh').onclick = () => paintOrders(true);
    await paintOrders(false);
    S.timer = setInterval(() => { if (!document.hidden && S.route === 'orders') paintOrders(true, true); }, 30000);
  }
  async function paintOrders(manual, quiet) {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (!$('#ordList')) return;
    if (error) { if (!quiet) $('#ordList').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    S.orders = data || [];
    const groups = { all: 'সব', run: 'চলছে', done: 'সম্পন্ন', bad: 'বাতিল' };
    const inGroup = (o, g) => g === 'all' || (g === 'run' && ['pending', 'processing'].includes(o.status)) ||
      (g === 'done' && ['completed', 'partial'].includes(o.status)) || (g === 'bad' && o.status === 'cancelled');
    $('#ordFilters').innerHTML = Object.entries(groups).map(([k, l]) =>
      `<button class="pill ${S.ordFilter === k ? 'on' : ''}" data-g="${k}" type="button">${l} (${esc(num(S.orders.filter((o) => inGroup(o, k)).length))})</button>`).join('');
    $$('#ordFilters .pill').forEach((b) => b.onclick = () => { S.ordFilter = b.dataset.g; paintOrders(false, true); });
    const list = S.orders.filter((o) => inGroup(o, S.ordFilter));
    if (!list.length) { $('#ordList').innerHTML = `<div class="card empty">${S.orders.length ? 'এই ভাগে কোনো অর্ডার নেই।' : 'এখনো কোনো অর্ডার নেই। <a href="#/">সার্ভিস দেখুন</a>'}</div>`; if (manual && !quiet) toast('আপডেট হয়েছে।'); return; }
    $('#ordList').innerHTML = '<div class="grid g2">' + list.map(orderCard).join('') + '</div>';
    if (manual && !quiet) toast('আপডেট হয়েছে।');
    loadProfile();
  }
  function orderCard(o) {
    const pct = o.status === 'completed' ? 100 : o.status === 'cancelled' ? 0 : Math.min(100, Math.floor((o.delivered / o.quantity) * 100));
    const remain = ['completed', 'cancelled'].includes(o.status) ? 0 : Math.max(0, o.quantity - o.delivered);
    return `<article class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="row">${pmark(o.platform)}<div class="grow"><b>${esc(o.service_name)}</b><div class="muted small">অর্ডার #${esc(num(o.id))} · ${esc(dateFmt(o.created_at))}</div></div>${statusBadge(o.status)}</div>
      <div class="linkline">${linkHtml(o.link)}</div>
      <div><div class="row small" style="margin-bottom:5px"><span>ডেলিভারি <b>${esc(num(o.delivered))}</b> / ${esc(num(o.quantity))}</span><span class="grow"></span><b>${esc(num(pct))}%</b></div>
        <div class="bar ${o.status === 'completed' ? 'done' : ''}"><i style="width:${pct}%"></i></div></div>
      <div class="kv"><span>বাকি: <b>${esc(num(remain))}</b></span>${o.start_count != null ? `<span>শুরুর সংখ্যা: <b>${esc(num(o.start_count))}</b></span>` : ''}
        <span>দাম: <b>${esc(money(o.price))}</b></span>${Number(o.refunded) > 0 ? `<span>ফেরত: <b style="color:var(--ok)">${esc(money(o.refunded))}</b></span>` : ''}</div>
      ${o.synced_at && !['completed', 'cancelled', 'partial'].includes(o.status) ? `<div class="small muted">সর্বশেষ আপডেট: ${esc(dateFmt(o.synced_at))}</div>` : ''}
      ${o.admin_note ? `<div class="small" style="background:var(--bg2);border-radius:9px;padding:8px 10px">${esc(o.admin_note)}</div>` : ''}
    </article>`;
  }

  /* ───────────── WALLET ───────────── */
  async function viewWallet() {
    if (!S.user) return needLogin('আমার ওয়ালেট');
    await loadProfile();
    const methods = (Array.isArray(S.settings.deposit_methods) ? S.settings.deposit_methods : []).filter((m) => m && m.active !== false);
    const minDep = Number(S.settings.min_deposit) > 0 ? Number(S.settings.min_deposit) : 50;
    const support = typeof S.settings.support_link === 'string' && /^https:\/\//i.test(S.settings.support_link) ? S.settings.support_link : '';
    $('#view').innerHTML = `${slot('top')}<div class="sect"><div class="card walletcard">
        <div style="opacity:.85">আপনার ব্যালেন্স</div><div style="font-size:34px;font-weight:800">${esc(money(S.profile ? S.profile.balance : 0))}</div></div></div>
      <div class="sect"><h2>টাকা জমা দিন</h2><div class="card">
        ${methods.length ? `
        <ol class="small" style="margin:0 0 12px 18px;padding:0;color:var(--muted)">
          <li>নিচের যেকোনো একটা নম্বরে টাকা পাঠান (Send Money)।</li>
          <li>যে নম্বর থেকে পাঠিয়েছেন, Transaction ID আর টাকার পরিমাণ নিচের ফর্মে লিখুন।</li>
          <li>যাচাই হলে ব্যালেন্সে টাকা যোগ হবে।</li></ol>
        <div class="grid g2" id="methods">${methods.map((m, i) => `
          <label class="method ${i === 0 ? 'on' : ''}"><input type="radio" name="meth" value="${esc(m.id)}" ${i === 0 ? 'checked' : ''}>
            <div class="grow"><b>${esc(m.name)}</b><div class="num">${esc(m.number)}</div><div class="muted small">${esc(m.note || '')}</div></div>
            <button class="btn ghost sm" type="button" data-copy="${esc(m.number)}">কপি</button></label>`).join('')}</div>
        <form id="df" novalidate>
          <label class="f" for="dAmt">টাকার পরিমাণ (সর্বনিম্ন ${esc(money(minDep))})</label><input class="in" id="dAmt" inputmode="numeric" autocomplete="off">
          <label class="f" for="dSnd">যে নম্বর থেকে পাঠিয়েছেন</label><input class="in" id="dSnd" inputmode="tel" autocomplete="off" placeholder="01XXXXXXXXX" maxlength="20">
          <label class="f" for="dTrx">Transaction ID</label><input class="in" id="dTrx" autocomplete="off" autocapitalize="characters" maxlength="20" placeholder="যেমন: 9A7B6C5D4E">
          <div class="err" id="dErr" role="alert"></div>
          <button class="btn block" id="dGo" type="submit" style="margin-top:8px">জমার অনুরোধ পাঠান</button>
        </form>` : '<div class="empty">এখন টাকা জমার ব্যবস্থা চালু নেই।</div>'}
      </div></div>
      ${slot('native')}<div class="sect"><h2>জমার ইতিহাস</h2><div class="card scroll" id="depList"><div class="empty"><span class="spin"></span></div></div></div>
      <div class="sect"><h2>লেনদেনের হিসাব</h2><div class="card scroll" id="txList"><div class="empty"><span class="spin"></span></div></div></div>
      <div class="sect"><h2>আমার তথ্য</h2><div class="card"><form id="pf" novalidate>
        <div class="muted small" style="margin-bottom:6px">${esc(S.user.email || '')}</div>
        <label class="f" for="pName">নাম</label><input class="in" id="pName" maxlength="80" value="${esc(S.profile ? S.profile.full_name : '')}">
        <label class="f" for="pPhone">মোবাইল</label><input class="in" id="pPhone" maxlength="20" value="${esc(S.profile ? S.profile.phone : '')}">
        <div class="err" id="pErr"></div><button class="btn" id="pGo" type="submit" style="margin-top:8px">সেভ করুন</button></form></div></div>
      ${slot('bottom')}${slot('link')}
      ${support ? `<p class="center"><a href="${esc(support)}" target="_blank" rel="noopener noreferrer">সাপোর্টে যোগাযোগ করুন</a></p>` : ''}`;

    mountAds();
    $$('[data-copy]').forEach((b) => b.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('নম্বর কপি হয়েছে।', 'ok'); } catch (x) { toast(b.dataset.copy); }
    });
    $$('input[name=meth]').forEach((r) => r.addEventListener('change', () => $$('.method').forEach((m) => m.classList.toggle('on', m.querySelector('input').checked))));
    const df = $('#df');
    if (df) df.addEventListener('submit', async (e) => {
      e.preventDefault(); const err = $('#dErr'); err.textContent = '';
      const method = ($('input[name=meth]:checked') || {}).value, amt = Number($('#dAmt').value.replace(/[^\d.]/g, ''));
      const snd = $('#dSnd').value.trim(), trx = $('#dTrx').value.trim().toUpperCase();
      if (!(amt >= minDep)) { err.textContent = `সর্বনিম্ন ${money(minDep)} জমা দিতে হবে।`; return; }
      if (!/^[A-Z0-9]{6,20}$/.test(trx)) { err.textContent = 'Transaction ID ঠিকভাবে লিখুন (ইংরেজি অক্ষর ও সংখ্যা)।'; return; }
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(snd.replace(/[\s-]/g, ''))) { err.textContent = 'সঠিক মোবাইল নম্বর দিন।'; return; }
      await busy($('#dGo'), async () => {
        const { error } = await sb.rpc('submit_deposit', { p_method: method, p_amount: amt, p_trx: trx, p_sender: snd });
        if (error) { err.textContent = errMsg(error); return; }
        toast('অনুরোধ পাঠানো হয়েছে। যাচাই হলে ব্যালেন্সে যোগ হবে।', 'ok');
        df.reset(); paintDeposits();
      });
    });
    $('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      await busy($('#pGo'), async () => {
        const { error } = await sb.rpc('update_my_profile', { p_name: $('#pName').value, p_phone: $('#pPhone').value });
        $('#pErr').textContent = error ? errMsg(error) : ''; if (!error) toast('সেভ হয়েছে।', 'ok');
      });
    });
    paintDeposits(); paintTxns();
  }
  async function paintDeposits() {
    const { data, error } = await sb.from('deposits').select('*').order('created_at', { ascending: false }).limit(30);
    const el = $('#depList'); if (!el) return;
    if (error) { el.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    if (!data.length) { el.innerHTML = '<div class="empty">এখনো কোনো জমা নেই।</div>'; return; }
    el.innerHTML = `<table class="t"><thead><tr><th>তারিখ</th><th>মাধ্যম</th><th>পরিমাণ</th><th>Trx ID</th><th>অবস্থা</th></tr></thead><tbody>` +
      data.map((d) => `<tr><td class="nowrap">${esc(dateFmt(d.created_at))}</td><td>${esc(String(d.method).toUpperCase())}</td><td>${esc(money(d.amount))}</td>
        <td>${esc(d.trx_id)}</td><td>${statusBadge(d.status)}${d.admin_note ? `<div class="small muted">${esc(d.admin_note)}</div>` : ''}</td></tr>`).join('') + '</tbody></table>';
  }
  async function paintTxns() {
    const { data, error } = await sb.from('wallet_txns').select('*').order('created_at', { ascending: false }).limit(50);
    const el = $('#txList'); if (!el) return;
    if (error) { el.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    if (!data.length) { el.innerHTML = '<div class="empty">এখনো কোনো লেনদেন নেই।</div>'; return; }
    const K = { deposit: 'জমা', order: 'অর্ডার', refund: 'ফেরত', adjust: 'সমন্বয়' };
    el.innerHTML = `<table class="t"><thead><tr><th>তারিখ</th><th>ধরন</th><th>পরিমাণ</th><th>ব্যালেন্স</th></tr></thead><tbody>` +
      data.map((t) => { const a = Number(t.amount); return `<tr><td class="nowrap">${esc(dateFmt(t.created_at))}</td>
        <td>${esc(K[t.kind] || t.kind)}<div class="small muted">${esc(t.note)}</div></td>
        <td class="${a >= 0 ? 'plus' : 'minus'}">${a >= 0 ? '+' : '−'}${esc(money(Math.abs(a)))}</td><td>${esc(money(t.balance_after))}</td></tr>`; }).join('') + '</tbody></table>';
  }

  /* ───────────── start ───────────── */
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { recoveryModal(); }
    if (event === 'SIGNED_OUT') { S.user = null; S.profile = null; paintHeader(); route(); }
  });
  (async function init() {
    const qi = $('#q');
    if (qi) qi.addEventListener('input', () => {
      S.q = qi.value.trim();
      if (S.route !== 'home' && S.route !== 'new') location.hash = '#/';
      else if ($('#svcGrid')) paintServices();
    });
    const so = $('#sideLogout'); if (so) so.onclick = doLogout;
    if (window.BXAds) window.BXAds.mount(document.querySelector('.side'));   // সাইডবার ব্যানার (একবারই)
    try { await loadSettings(); } catch (e) { /* defaults are fine */ }
    await loadProfile();
    route();
  })();
})();
