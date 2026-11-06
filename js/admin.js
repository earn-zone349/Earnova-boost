/* Admin page. Real protection is in the database (is_admin()); this page only shows buttons. */
(function () {
  'use strict';
  const { sb, configured, $, $$, esc, num, money, dateFmt, PLATFORMS, platMark, statusBadge, errMsg, toast,
          openModal, closeModal, busy, linkHtml, authModal, setupMissing } = window.BX;
  if (!configured || !sb) { setupMissing(); return; }

  const S = { tab: 'dash', dash: null, depFilter: 'pending', ordFilter: 'pending', userQ: '' };
  const TABS = [['dash', 'ড্যাশবোর্ড'], ['deposits', 'জমা'], ['orders', 'অর্ডার'], ['services', 'সার্ভিস'], ['users', 'ইউজার'], ['settings', 'সেটিংস']];

  async function start() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return gate();
    const { data: p } = await sb.from('profiles').select('is_admin,banned,email').eq('id', session.user.id).maybeSingle();
    $('#hdrRight').innerHTML = `<span class="muted small">${esc(session.user.email || '')}</span>
      <button class="btn ghost sm" id="lo" type="button" style="margin-left:8px">লগআউট</button>`;
    $('#lo').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    if (!p || !p.is_admin || p.banned) {
      $('#view').innerHTML = `<div class="card center sect"><h2>অনুমতি নেই</h2><p class="muted">এই অ্যাকাউন্ট অ্যাডমিন না।</p></div>`;
      return;
    }
    shell();
    await refreshDash();
    go(S.tab);
  }
  function gate() {
    $('#view').innerHTML = `<div class="card center sect"><h2>অ্যাডমিন লগইন</h2><button class="btn" id="g" type="button">লগইন করুন</button></div>`;
    $('#g').onclick = () => authModal(() => location.reload(), 'in');
  }
  function shell() {
    $('#view').innerHTML = `<div class="admtabs" id="tabs"></div><div id="pane"></div>`;
    paintTabs();
  }
  function paintTabs() {
    const d = S.dash || {};
    const badge = { deposits: d.pending_deposits, orders: d.pending_orders };
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-t="${k}" type="button">${l}${badge[k] > 0 ? `<span class="cnt">${esc(num(badge[k]))}</span>` : ''}</button>`).join('');
    $$('#tabs button').forEach((b) => b.onclick = () => go(b.dataset.t));
  }
  async function refreshDash() {
    const { data } = await sb.rpc('admin_dashboard');
    S.dash = data || {}; if ($('#tabs')) paintTabs();
  }
  function go(t) {
    S.tab = t; paintTabs();
    ({ dash: viewDash, deposits: viewDeposits, orders: viewOrders, services: viewServices, users: viewUsers, settings: viewSettings })[t]();
  }
  const pane = () => $('#pane');
  const loading = () => { pane().innerHTML = '<div class="empty"><span class="spin"></span></div>'; };

  /* ───── dashboard ───── */
  async function viewDash() {
    loading(); await refreshDash(); const d = S.dash;
    const items = [['মোট ইউজার', num(d.users)], ['জমার অপেক্ষায়', num(d.pending_deposits)], ['নতুন অর্ডার', num(d.pending_orders)], ['চলমান অর্ডার', num(d.running_orders)],
      ['মোট জমা', money(d.deposited_total)], ['মোট বিক্রি (ফেরত বাদে)', money(d.sales_total)], ['ইউজারদের ওয়ালেটে মোট', money(d.wallets_total)]];
    pane().innerHTML = `<div class="grid g4">${items.map(([l, v]) => `<div class="card stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <p class="muted small" style="margin-top:14px">“ওয়ালেটে মোট” হলো ইউজারদের কাছে থাকা তোমার দেনা — এই টাকা দিয়ে তারা অর্ডার করতে পারবে।</p>`;
  }

  /* ───── deposits ───── */
  async function viewDeposits() {
    pane().innerHTML = `<div class="filters" id="df"></div><div id="dl"><div class="empty"><span class="spin"></span></div></div>`;
    const fs = [['pending', 'অপেক্ষমাণ'], ['approved', 'অনুমোদিত'], ['rejected', 'বাতিল'], ['all', 'সব']];
    $('#df').innerHTML = fs.map(([k, l]) => `<button class="pill ${S.depFilter === k ? 'on' : ''}" data-k="${k}" type="button">${l}</button>`).join('');
    $$('#df .pill').forEach((b) => b.onclick = () => { S.depFilter = b.dataset.k; viewDeposits(); });
    let q = sb.from('deposits').select('*, profiles(email,full_name)').order('created_at', { ascending: false }).limit(100);
    if (S.depFilter !== 'all') q = q.eq('status', S.depFilter);
    const { data, error } = await q;
    if (error) { $('#dl').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    if (!data.length) { $('#dl').innerHTML = '<div class="card empty">কিছু নেই।</div>'; return; }
    $('#dl').innerHTML = '<div class="grid g2">' + data.map((d) => `<article class="card" style="display:flex;flex-direction:column;gap:8px">
      <div class="row"><b class="grow">${esc(money(d.amount))} · ${esc(String(d.method).toUpperCase())}</b>${statusBadge(d.status)}</div>
      <div class="small">Trx ID: <b>${esc(d.trx_id)}</b></div>
      <div class="small">প্রেরকের নম্বর: <b>${esc(d.sender)}</b></div>
      <div class="small muted">${esc((d.profiles && d.profiles.full_name) || '')} · ${esc((d.profiles && d.profiles.email) || '')}<br>${esc(dateFmt(d.created_at))}</div>
      ${d.admin_note ? `<div class="small">নোট: ${esc(d.admin_note)}</div>` : ''}
      ${d.status === 'pending' ? `<div class="row"><button class="btn ok sm grow" data-ap="${esc(d.id)}" type="button">অনুমোদন (টাকা যোগ)</button>
        <button class="btn bad sm grow" data-rj="${esc(d.id)}" type="button">বাতিল</button></div>` : ''}</article>`).join('') + '</div>';
    $$('[data-ap]').forEach((b) => b.onclick = () => reviewDeposit(Number(b.dataset.ap), true, data));
    $$('[data-rj]').forEach((b) => b.onclick = () => reviewDeposit(Number(b.dataset.rj), false, data));
  }
  function reviewDeposit(id, ok, list) {
    const d = list.find((x) => x.id === id); if (!d) return;
    const ov = openModal(`<h2 style="margin-top:0">${ok ? 'জমা অনুমোদন' : 'জমা বাতিল'}</h2>
      <p>${esc(money(d.amount))} · ${esc(String(d.method).toUpperCase())} · Trx <b>${esc(d.trx_id)}</b></p>
      ${ok ? '<p class="small muted">আগে নিজের bKash/Nagad অ্যাপে মিলিয়ে নাও টাকাটা সত্যিই এসেছে কিনা। অনুমোদনের পর ইউজারের ব্যালেন্সে টাকা যোগ হবে, ফেরানো যাবে না।</p>' : ''}
      <label class="f" for="dn">নোট (ইউজার দেখতে পাবে)${ok ? ' — ঐচ্ছিক' : ''}</label><input class="in" id="dn" maxlength="200">
      <div class="err" id="de"></div>
      <button class="btn block ${ok ? 'ok' : 'bad'}" id="dg" type="button" style="margin-top:8px">${ok ? 'অনুমোদন করুন' : 'বাতিল করুন'}</button>`);
    $('#dg', ov).onclick = (e) => busy(e.currentTarget, async () => {
      const { error } = await sb.rpc('admin_review_deposit', { p_id: id, p_approve: ok, p_note: $('#dn', ov).value });
      if (error) { $('#de', ov).textContent = errMsg(error); return; }
      closeModal(); toast('হয়েছে।', 'ok'); await refreshDash(); viewDeposits();
    });
  }

  /* ───── orders ───── */
  async function viewOrders() {
    pane().innerHTML = `<div class="row" style="gap:8px;margin-bottom:8px"><div class="filters grow" id="of"></div><button class="btn sm" id="syncAll" type="button">🔄 সব সিঙ্ক</button></div><div id="ol"><div class="empty"><span class="spin"></span></div></div>`;
    const fs = [['pending', 'নতুন'], ['processing', 'চলছে'], ['completed', 'সম্পন্ন'], ['partial', 'আংশিক'], ['cancelled', 'বাতিল'], ['all', 'সব']];
    $('#of').innerHTML = fs.map(([k, l]) => `<button class="pill ${S.ordFilter === k ? 'on' : ''}" data-k="${k}" type="button">${l}</button>`).join('');
    $$('#of .pill').forEach((b) => b.onclick = () => { S.ordFilter = b.dataset.k; viewOrders(); });
    $('#syncAll').onclick = (e) => busy(e.currentTarget, () => syncOrders(null));
    let q = sb.from('orders').select('*, profiles(email,full_name), order_links(task_id)').order('created_at', { ascending: false }).limit(100);
    if (S.ordFilter !== 'all') q = q.eq('status', S.ordFilter);
    const { data, error } = await q;
    if (error) { $('#ol').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    if (!data.length) { $('#ol').innerHTML = '<div class="card empty">কিছু নেই।</div>'; return; }
    $('#ol').innerHTML = '<div class="grid g2">' + data.map((o) => {
      const final = ['completed', 'partial', 'cancelled'].includes(o.status);
      return `<article class="card" style="display:flex;flex-direction:column;gap:8px">
        <div class="row">${platMark(o.platform)}<div class="grow"><b>#${esc(num(o.id))} ${esc(o.service_name)}</b>
          <div class="small muted">${esc((o.profiles && o.profiles.email) || '')} · ${esc(dateFmt(o.created_at))}</div></div>${statusBadge(o.status)}</div>
        <div class="linkline">${linkHtml(o.link)}</div>
        <div class="kv"><span>পরিমাণ: <b>${esc(num(o.quantity))}</b></span><span>দাম: <b>${esc(money(o.price))}</b></span><span>ডেলিভারি: <b>${esc(num(o.delivered))}</b></span>${o.start_count != null ? `<span>শুরু: <b>${esc(num(o.start_count))}</b></span>` : ''}${Number(o.refunded) > 0 ? `<span>ফেরত: <b>${esc(money(o.refunded))}</b></span>` : ''}</div>
        ${o.admin_note ? `<div class="small">নোট: ${esc(o.admin_note)}</div>` : ''}
        ${o.synced_at ? `<div class="small muted">সর্বশেষ সিঙ্ক: ${esc(dateFmt(o.synced_at))}</div>` : ''}
        ${final ? '' : `<div class="row" style="gap:6px;flex-wrap:wrap"><input class="in" style="max-width:110px" data-tk="${esc(o.id)}" placeholder="EARNOVA টাস্ক নং" maxlength="64" value="${esc((o.order_links && o.order_links.task_id) || '')}">
          <button class="btn sm" data-tks="${esc(o.id)}" type="button">সেট</button>
          <button class="btn sm" data-sy="${esc(o.id)}" type="button">🔄 সিঙ্ক</button>
          <button class="btn sm" data-ed="${esc(o.id)}" type="button">আপডেট করুন</button></div>`}</article>`;
    }).join('') + '</div>';
    $$('[data-ed]').forEach((b) => b.onclick = () => editOrder(data.find((x) => x.id === Number(b.dataset.ed))));
    $$('[data-tks]').forEach((b) => b.onclick = () => busy(b, async () => {
      const id = Number(b.dataset.tks), inp = document.querySelector('[data-tk="' + id + '"]');
      const { error } = await sb.rpc('admin_set_order_task', { p_order: id, p_task: inp.value.trim() });
      if (error) { toast(errMsg(error), 'bad'); return; }
      toast(inp.value.trim() ? 'টাস্ক নম্বর সেট হয়েছে।' : 'টাস্ক নম্বর সরানো হয়েছে।', 'ok');
    }));
    $$('[data-sy]').forEach((b) => b.onclick = () => busy(b, () => syncOrders(Number(b.dataset.sy))));
  }
  async function syncOrders(orderId) {
    const { data, error } = await sb.functions.invoke('sync-progress', { body: orderId ? { order_id: orderId } : {} });
    if (error || !data || !data.ok) { toast('সিঙ্ক হয়নি — Edge Function ও Secrets ঠিক আছে কিনা দেখুন।', 'bad'); return; }
    const bad = (data.results || []).filter((r) => r.error).length;
    toast(data.checked ? `${num(data.updated)}টি আপডেট হয়েছে` + (bad ? `, ${num(bad)}টিতে টাস্ক খুঁজে পাওয়া যায়নি` : '') + '।' : 'সিঙ্ক করার মতো অর্ডার নেই (টাস্ক নম্বর সেট করুন)।', bad ? 'bad' : 'ok');
    await refreshDash(); viewOrders();
  }
  function editOrder(o) {
    if (!o) return;
    const ov = openModal(`<h2 style="margin-top:0">অর্ডার #${esc(num(o.id))}</h2>
      <div class="small muted">${esc(o.service_name)} · পরিমাণ ${esc(num(o.quantity))} · দাম ${esc(money(o.price))}</div>
      <label class="f" for="es">স্ট্যাটাস</label>
      <select class="in" id="es"><option value="processing">চলছে</option><option value="completed">সম্পন্ন (সবটা ডেলিভারি)</option>
        <option value="partial">আংশিক সম্পন্ন (বাকিটার টাকা ফেরত)</option><option value="cancelled">বাতিল (পুরো টাকা ফেরত)</option></select>
      <label class="f" for="ed">এ পর্যন্ত ডেলিভারি</label><input class="in" id="ed" inputmode="numeric" value="${esc(o.delivered)}">
      <label class="f" for="est">শুরুর সংখ্যা (ঐচ্ছিক)</label><input class="in" id="est" inputmode="numeric" value="${o.start_count == null ? '' : esc(o.start_count)}">
      <label class="f" for="en">ইউজারের জন্য নোট (ঐচ্ছিক)</label><input class="in" id="en" maxlength="300" value="${esc(o.admin_note || '')}">
      <div id="ref" class="small" style="margin-top:8px;color:var(--warn)"></div>
      <div class="err" id="ee"></div>
      <button class="btn block" id="eg" type="button" style="margin-top:8px">সেভ করুন</button>`);
    const refEl = $('#ref', ov);
    const upd = () => {
      const st = $('#es', ov).value, del = parseInt($('#ed', ov).value, 10) || 0;
      if (st === 'cancelled') refEl.textContent = `ইউজারকে ${money(o.price)} ফেরত যাবে।`;
      else if (st === 'partial') refEl.textContent = `ইউজারকে ${money(Math.round(Number(o.price) * (o.quantity - del) / o.quantity * 100) / 100)} ফেরত যাবে।`;
      else refEl.textContent = '';
    };
    $('#es', ov).onchange = upd; $('#ed', ov).oninput = upd; upd();
    $('#eg', ov).onclick = (e) => busy(e.currentTarget, async () => {
      const st = $('#es', ov).value, delRaw = $('#ed', ov).value.trim(), stRaw = $('#est', ov).value.trim();
      if (['cancelled', 'partial'].includes(st) && !confirm('এটা ফেরানো যাবে না — ইউজারকে টাকা ফেরত দেওয়া হবে। নিশ্চিত?')) return;
      const { error } = await sb.rpc('admin_update_order', { p_id: o.id, p_status: st,
        p_delivered: delRaw === '' ? null : parseInt(delRaw, 10), p_start: stRaw === '' ? null : parseInt(stRaw, 10), p_note: $('#en', ov).value });
      if (error) { $('#ee', ov).textContent = errMsg(error); return; }
      closeModal(); toast('আপডেট হয়েছে।', 'ok'); await refreshDash(); viewOrders();
    });
  }

  /* ───── services ───── */
  async function viewServices() {
    loading();
    const { data, error } = await sb.from('services').select('*').order('platform').order('sort_order').order('id');
    if (error) { pane().innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const platOpts = (sel) => Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    pane().innerHTML = `<div class="card scroll"><table class="t"><thead><tr><th>প্ল্যাটফর্ম</th><th>নাম</th><th>দাম/১০০০ (৳)</th><th>সর্বনিম্ন</th><th>সর্বোচ্চ</th><th>ক্রম</th><th>চালু</th><th></th></tr></thead><tbody>
      ${data.map((s) => `<tr data-id="${esc(s.id)}"><td><select class="in" data-f="platform">${platOpts(s.platform)}</select></td>
        <td><input class="in" data-f="name" value="${esc(s.name)}" maxlength="120" style="min-width:170px"><input class="in" data-f="description" value="${esc(s.description)}" maxlength="400" placeholder="বিবরণ" style="min-width:170px;margin-top:4px"></td>
        <td><input class="in" data-f="price_per_1000" inputmode="decimal" value="${esc(s.price_per_1000)}" style="width:90px"></td>
        <td><input class="in" data-f="min_qty" inputmode="numeric" value="${esc(s.min_qty)}" style="width:80px"></td>
        <td><input class="in" data-f="max_qty" inputmode="numeric" value="${esc(s.max_qty)}" style="width:90px"></td>
        <td><input class="in" data-f="sort_order" inputmode="numeric" value="${esc(s.sort_order)}" style="width:60px"></td>
        <td><input type="checkbox" data-f="active" ${s.active ? 'checked' : ''}></td>
        <td><button class="btn sm" data-save type="button">সেভ</button></td></tr>`).join('')}</tbody></table></div>
      <div class="card" style="margin-top:14px"><h3>নতুন সার্ভিস</h3><form id="nf" class="inl">
        <select class="in" id="nPlat">${platOpts('facebook')}</select><input class="in" id="nName" placeholder="নাম" maxlength="120">
        <input class="in" id="nPrice" placeholder="দাম/১০০০" inputmode="decimal" style="width:100px"><input class="in" id="nMin" placeholder="সর্বনিম্ন" inputmode="numeric" style="width:90px">
        <input class="in" id="nMax" placeholder="সর্বোচ্চ" inputmode="numeric" style="width:90px"><button class="btn sm" type="submit">যোগ করুন</button></form><div class="err" id="ne"></div></div>`;
    $$('[data-save]').forEach((b) => b.onclick = () => busy(b, async () => {
      const tr = b.closest('tr'), g = (f) => $(`[data-f=${f}]`, tr);
      const row = { platform: g('platform').value, name: g('name').value.trim(), description: g('description').value.trim(),
        price_per_1000: Number(g('price_per_1000').value), min_qty: parseInt(g('min_qty').value, 10), max_qty: parseInt(g('max_qty').value, 10),
        sort_order: parseInt(g('sort_order').value, 10) || 100, active: g('active').checked };
      if (!(row.price_per_1000 >= 0) || !(row.min_qty > 0) || !(row.max_qty >= row.min_qty) || row.name.length < 2) { toast('তথ্য ঠিক নেই (দাম, সর্বনিম্ন, সর্বোচ্চ দেখুন)।', 'bad'); return; }
      const { error } = await sb.from('services').update(row).eq('id', Number(tr.dataset.id));
      toast(error ? 'সেভ হয়নি — তথ্য ঠিক আছে কিনা দেখুন।' : 'সেভ হয়েছে।', error ? 'bad' : 'ok');
    }));
    $('#nf').onsubmit = async (e) => {
      e.preventDefault();
      const row = { platform: $('#nPlat').value, name: $('#nName').value.trim(), price_per_1000: Number($('#nPrice').value),
        min_qty: parseInt($('#nMin').value, 10), max_qty: parseInt($('#nMax').value, 10) };
      if (!(row.price_per_1000 >= 0) || !(row.min_qty > 0) || !(row.max_qty >= row.min_qty) || row.name.length < 2) { $('#ne').textContent = 'সব ঘর ঠিকভাবে পূরণ করুন।'; return; }
      const { error } = await sb.from('services').insert(row);
      if (error) { $('#ne').textContent = 'যোগ হয়নি।'; return; }
      toast('যোগ হয়েছে।', 'ok'); viewServices();
    };
  }

  /* ───── users ───── */
  async function viewUsers() {
    pane().innerHTML = `<form class="inl" id="sf" style="margin-bottom:12px"><input class="in" id="q" placeholder="ইমেইল / নাম / মোবাইল" value="${esc(S.userQ)}" style="flex:1;min-width:200px"><button class="btn sm" type="submit">খুঁজুন</button></form><div id="ul"><div class="empty"><span class="spin"></span></div></div>`;
    $('#sf').onsubmit = (e) => { e.preventDefault(); S.userQ = $('#q').value.trim(); viewUsers(); };
    let q = sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    const t = S.userQ.replace(/[,()%*_\\"']/g, ' ').trim();
    if (t) q = q.or(`email.ilike.%${t}%,full_name.ilike.%${t}%,phone.ilike.%${t}%`);
    const { data, error } = await q;
    if (error) { $('#ul').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    if (!data.length) { $('#ul').innerHTML = '<div class="card empty">কেউ নেই।</div>'; return; }
    $('#ul').innerHTML = `<div class="card scroll"><table class="t"><thead><tr><th>ইউজার</th><th>ব্যালেন্স</th><th>যোগ দিয়েছে</th><th></th></tr></thead><tbody>` + data.map((u) => `<tr>
      <td><b>${esc(u.full_name || '—')}</b>${u.is_admin ? ' <span class="badge b-processing">admin</span>' : ''}${u.banned ? ' <span class="badge b-cancelled">ব্যান</span>' : ''}<div class="small muted">${esc(u.email)}<br>${esc(u.phone)}</div></td>
      <td class="nowrap">${esc(money(u.balance))}</td><td class="nowrap small">${esc(dateFmt(u.created_at))}</td>
      <td class="nowrap"><button class="btn ghost sm" data-adj="${esc(u.id)}" type="button">টাকা বদলান</button>
      ${u.is_admin ? '' : `<button class="btn ghost sm" data-ban="${esc(u.id)}" data-b="${u.banned ? 0 : 1}" type="button">${u.banned ? 'আনব্যান' : 'ব্যান'}</button>`}</td></tr>`).join('') + '</tbody></table></div>';
    $$('[data-adj]').forEach((b) => b.onclick = () => adjust(data.find((x) => x.id === b.dataset.adj)));
    $$('[data-ban]').forEach((b) => b.onclick = () => busy(b, async () => {
      const ban = b.dataset.b === '1';
      if (ban && !confirm('এই ইউজার আর অর্ডার বা জমা দিতে পারবে না। নিশ্চিত?')) return;
      const { error } = await sb.rpc('admin_set_banned', { p_user: b.dataset.ban, p_banned: ban });
      if (error) { toast(errMsg(error), 'bad'); return; }
      toast('হয়েছে।', 'ok'); viewUsers();
    }));
  }
  function adjust(u) {
    if (!u) return;
    const ov = openModal(`<h2 style="margin-top:0">ব্যালেন্স সমন্বয়</h2><p>${esc(u.email)}<br>বর্তমান: <b>${esc(money(u.balance))}</b></p>
      <label class="f" for="aa">পরিমাণ (যোগ করতে ধনাত্মক, কাটতে ঋণাত্মক, যেমন -50)</label><input class="in" id="aa" inputmode="decimal">
      <label class="f" for="an">কারণ (বাধ্যতামূলক)</label><input class="in" id="an" maxlength="200">
      <div class="err" id="ae"></div><button class="btn block" id="ag" type="button" style="margin-top:8px">সেভ করুন</button>`);
    $('#ag', ov).onclick = (e) => busy(e.currentTarget, async () => {
      const a = Number($('#aa', ov).value);
      if (!a) { $('#ae', ov).textContent = 'পরিমাণ লিখুন।'; return; }
      const { error } = await sb.rpc('admin_adjust_balance', { p_user: u.id, p_amount: a, p_note: $('#an', ov).value });
      if (error) { $('#ae', ov).textContent = errMsg(error); return; }
      closeModal(); toast('হয়েছে।', 'ok'); viewUsers();
    });
  }

  /* ───── settings ───── */
  async function viewSettings() {
    loading();
    const { data, error } = await sb.from('settings').select('key,value');
    if (error) { pane().innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    const o = {}; data.forEach((r) => { o[r.key] = r.value; });
    const methods = Array.isArray(o.deposit_methods) ? o.deposit_methods : [];
    pane().innerHTML = `<div class="card"><form id="sf2">
      <label class="f" for="sn">সাইটের নাম</label><input class="in" id="sn" maxlength="40" value="${esc(typeof o.site_name === 'string' ? o.site_name : '')}">
      <label class="f" for="nt">হোম পেজের নোটিশ (খালি রাখলে দেখাবে না)</label><input class="in" id="nt" maxlength="300" value="${esc(typeof o.notice === 'string' ? o.notice : '')}">
      <label class="f" for="md">সর্বনিম্ন জমা (৳)</label><input class="in" id="md" inputmode="numeric" value="${esc(o.min_deposit == null ? 50 : o.min_deposit)}">
      <label class="f" for="sl">সাপোর্ট লিংক (Telegram/WhatsApp/Messenger, https:// দিয়ে)</label><input class="in" id="sl" maxlength="200" value="${esc(typeof o.support_link === 'string' ? o.support_link : '')}">
      <h3 style="margin-top:18px">পেমেন্ট মাধ্যম</h3>
      <div id="ml">${methods.map(methRow).join('')}</div>
      <button class="btn ghost sm" id="addm" type="button" style="margin-top:8px">+ আরেকটা মাধ্যম</button>
      <div class="err" id="se"></div><button class="btn block" id="sg" type="submit" style="margin-top:14px">সব সেভ করুন</button></form></div>`;
    $('#addm').onclick = () => { $('#ml').insertAdjacentHTML('beforeend', methRow({ id: '', name: '', number: '', note: 'Send Money (Personal)', active: true })); };
    $('#ml').addEventListener('click', (e) => { const x = e.target.closest('[data-rm]'); if (x) x.closest('.mrow').remove(); });
    $('#sf2').onsubmit = (e) => {
      e.preventDefault();
      busy($('#sg'), async () => {
        const rows = $$('.mrow').map((r) => ({ id: $('[data-k=id]', r).value.trim().toLowerCase(), name: $('[data-k=name]', r).value.trim(),
          number: $('[data-k=number]', r).value.trim(), note: $('[data-k=note]', r).value.trim(), active: $('[data-k=active]', r).checked }));
        if (rows.some((m) => !/^[a-z0-9_]{2,20}$/.test(m.id) || !m.name || !m.number)) { $('#se').textContent = 'প্রতিটি মাধ্যমে কোড (ইংরেজি ছোট হাতের, যেমন bkash), নাম ও নম্বর লাগবে।'; return; }
        if (new Set(rows.map((m) => m.id)).size !== rows.length) { $('#se').textContent = 'কোড একটার সাথে আরেকটা মিলবে না।'; return; }
        const md = Number($('#md').value);
        if (!(md >= 1)) { $('#se').textContent = 'সর্বনিম্ন জমা ঠিক নেই।'; return; }
        const sl = $('#sl').value.trim();
        if (sl && !/^https:\/\//i.test(sl)) { $('#se').textContent = 'সাপোর্ট লিংক https:// দিয়ে শুরু হতে হবে।'; return; }
        const now = new Date().toISOString();
        const { error: e2 } = await sb.from('settings').upsert([
          { key: 'site_name', value: $('#sn').value.trim() || 'BoostBD', updated_at: now }, { key: 'notice', value: $('#nt').value.trim(), updated_at: now },
          { key: 'min_deposit', value: md, updated_at: now }, { key: 'support_link', value: sl, updated_at: now },
          { key: 'deposit_methods', value: rows, updated_at: now }]);
        $('#se').textContent = e2 ? 'সেভ হয়নি।' : ''; if (!e2) toast('সেভ হয়েছে।', 'ok');
      });
    };
  }
  function methRow(m) {
    return `<div class="mrow card" style="padding:10px;margin-bottom:8px"><div class="inl">
      <input class="in" data-k="id" placeholder="কোড (bkash)" value="${esc(m.id)}" style="width:110px" maxlength="20">
      <input class="in" data-k="name" placeholder="নাম" value="${esc(m.name)}" style="width:110px" maxlength="30">
      <input class="in" data-k="number" placeholder="নম্বর" value="${esc(m.number)}" style="width:150px" maxlength="30">
      <input class="in" data-k="note" placeholder="নোট" value="${esc(m.note || '')}" style="flex:1;min-width:140px" maxlength="60">
      <label class="small"><input type="checkbox" data-k="active" ${m.active !== false ? 'checked' : ''}> চালু</label>
      <button class="btn ghost sm" data-rm type="button">মুছুন</button></div></div>`;
  }

  start();
})();
