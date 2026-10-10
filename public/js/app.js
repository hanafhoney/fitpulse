(() => {
  'use strict';

  /* ================= CONFIG & HELPERS ================= */
  const API = '/api';
  const CUR = 'Rs ';
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modalRoot');
  const $ = (s, r = document) => r.querySelector(s);

  const state = {
    token: localStorage.getItem('fp_token'),
    user: null,
    tab: 'overview',
    members: [],
    trainers: [],
    search: '',
    payFilter: 'ALL',
    charts: {}
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => CUR + Number(n || 0).toLocaleString('en-US');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const initials = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const badge = (s) => `<span class="badge ${s === 'Paid' ? 'paid' : 'pending'}">${s === 'Paid' ? 'Paid' : 'Pending Dues'}</span>`;

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (res.status === 401 && state.token && !path.startsWith('/auth/login')) {
      logout(true);
      throw new Error(data.message || 'Session expired');
    }
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  }

  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<i class="fa-solid ${type === 'ok' ? 'fa-circle-check' : type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i><span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  function countUp(el, to, { money: isMoney = false, duration = 1200 } = {}) {
    const start = performance.now();
    const fmt = (v) => (isMoney ? money(Math.round(v)) : Math.round(v).toLocaleString('en-US'));
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const runCounters = (root = document) =>
    root.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), { money: el.dataset.money === '1' }));

  function destroyCharts() {
    Object.values(state.charts).forEach((c) => c && c.destroy());
    state.charts = {};
  }

  function setBtnLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span>' : label;
  }

  /* ================= EVENT DELEGATION ================= */
  const actions = {};
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const fn = actions[t.dataset.action];
    if (fn) fn(t, e);
  });

  /* ================= MODAL ================= */
  function openModal(title, bodyHTML, onSubmit, submitLabel = 'Save') {
    modalRoot.innerHTML = `
      <div class="modal-bg" id="mbg">
        <div class="modal" role="dialog" aria-modal="true">
          <button class="x" type="button" data-action="closeModal" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
          <h3>${esc(title)}</h3>
          <form id="modalForm" novalidate>
            ${bodyHTML}
            <div class="foot">
              <button type="button" class="btn" data-action="closeModal">Cancel</button>
              <button type="submit" class="btn primary" id="modalSubmit">${esc(submitLabel)}</button>
            </div>
          </form>
        </div>
      </div>`;
    const form = $('#modalForm');
    $('#mbg').addEventListener('mousedown', (e) => { if (e.target.id === 'mbg') closeModal(); });
    const first = form.querySelector('input,select');
    if (first) setTimeout(() => first.focus(), 80);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = $('#modalSubmit');
      setBtnLoading(btn, true);
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        await onSubmit(data);
        closeModal();
      } catch (err) {
        toast(err.message, 'err');
        setBtnLoading(btn, false, esc(submitLabel));
      }
    };
  }
  function closeModal() {
    const m = $('.modal');
    if (!m) return;
    m.classList.add('closing');
    setTimeout(() => (modalRoot.innerHTML = ''), 180);
  }
  actions.closeModal = closeModal;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ================= AUTH ================= */
  function logout(expired = false) {
    localStorage.removeItem('fp_token');
    state.token = null; state.user = null; state.tab = 'overview';
    destroyCharts();
    renderLogin('login');
    if (expired) toast('Session expired, please login again', 'info');
  }
  actions.logout = () => logout();

  function renderLogin(mode = 'login') {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card anim-pop">
          <div class="brand big">
            <div class="logo"><i class="fa-solid fa-dumbbell"></i></div>
            <div><h1>FitPulse</h1><p>Gym Management Suite</p></div>
          </div>
          <div class="seg">
            <button type="button" class="${mode === 'login' ? 'on' : ''}" data-action="authMode" data-mode="login">Login</button>
            <button type="button" class="${mode === 'signup' ? 'on' : ''}" data-action="authMode" data-mode="signup">Sign Up</button>
          </div>
          <form id="authForm" novalidate>
            ${mode === 'signup' ? `
              <div class="field anim-up" style="--i:0"><label>Full Name</label><div class="input-wrap"><i class="fa-solid fa-user"></i><input name="name" required placeholder="Your name" autocomplete="name"></div></div>
              <div class="field anim-up" style="--i:1"><label>Phone</label><div class="input-wrap"><i class="fa-solid fa-phone"></i><input name="phone" placeholder="03xx-xxxxxxx" autocomplete="tel"></div></div>` : ''}
            <div class="field anim-up" style="--i:2"><label>Email</label><div class="input-wrap"><i class="fa-solid fa-envelope"></i><input name="email" type="email" required placeholder="you@example.com" autocomplete="email"></div></div>
            <div class="field anim-up" style="--i:3"><label>Password</label><div class="input-wrap"><i class="fa-solid fa-lock"></i><input name="password" type="password" required minlength="6" placeholder="Min 6 characters" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></div></div>
            <button class="btn primary w100 anim-up" style="--i:4;margin-top:6px" type="submit" id="authBtn">${mode === 'login' ? 'Login <i class="fa-solid fa-arrow-right"></i>' : 'Create Account <i class="fa-solid fa-user-plus"></i>'}</button>
          </form>
          ${mode === 'login' ? `
            <div class="demo-box anim-up" style="--i:5">
              <i class="fa-solid fa-circle-info"></i> Demo accounts (auto-created on first run):
              <div class="row">
                <button class="btn sm w100" type="button" data-action="fillDemo" data-email="admin@fitpulse.com" data-pass="admin123"><i class="fa-solid fa-shield-halved"></i> Admin</button>
                <button class="btn sm w100" type="button" data-action="fillDemo" data-email="hamza@fitpulse.com" data-pass="member123"><i class="fa-solid fa-user"></i> Member</button>
              </div>
            </div>` : ''}
        </div>
      </div>`;

    const label = mode === 'login' ? 'Login <i class="fa-solid fa-arrow-right"></i>' : 'Create Account <i class="fa-solid fa-user-plus"></i>';
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = $('#authBtn');
      setBtnLoading(btn, true);
      try {
        const body = Object.fromEntries(new FormData(form).entries());
        const data = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
        state.token = data.token;
        localStorage.setItem('fp_token', data.token);
        state.user = data.user;
        toast(`Welcome${mode === 'login' ? ' back' : ''}, ${data.user.name.split(' ')[0]}!`);
        route();
      } catch (err) {
        toast(err.message, 'err');
        setBtnLoading(btn, false, label);
      }
    };
  }
  actions.authMode = (t) => renderLogin(t.dataset.mode);
  actions.fillDemo = (t) => {
    $('#authForm [name=email]').value = t.dataset.email;
    $('#authForm [name=password]').value = t.dataset.pass;
  };

  /* ================= ROUTER ================= */
  async function boot() {
    if (!state.token) return renderLogin('login');
    app.innerHTML = `<div class="auth-wrap"><div class="skel" style="width:260px"></div></div>`;
    try {
      const { user } = await api('/auth/me');
      state.user = user;
      route();
    } catch (_) {
      logout();
    }
  }
  function route() {
    if (!state.user) return renderLogin('login');
    state.user.role === 'admin' ? renderAdminShell() : renderMember();
  }

  /* ================= ADMIN SHELL ================= */
  const ADMIN_TABS = [
    { id: 'overview', icon: 'fa-chart-pie', label: 'Overview', sub: 'Business snapshot at a glance' },
    { id: 'members', icon: 'fa-users', label: 'Members', sub: 'Manage everyone in your gym' },
    { id: 'trainers', icon: 'fa-user-ninja', label: 'Trainers', sub: 'Your coaching team' },
    { id: 'payments', icon: 'fa-money-bill-wave', label: 'Dues', sub: 'Paid and pending fees' },
    { id: 'plans', icon: 'fa-calendar-week', label: 'Weekly Plans', sub: 'Workout and diet routine for the week' }
  ];

  function renderAdminShell() {
    app.innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div>
            <div class="brand"><div class="logo"><i class="fa-solid fa-dumbbell"></i></div><div><strong>FitPulse</strong><p>Admin Panel</p></div></div>
            <nav class="nav">
              ${ADMIN_TABS.map((t, i) => `<button style="--i:${i}" data-action="adminTab" data-tab="${t.id}" id="nav-${t.id}"><i class="fa-solid ${t.icon}"></i><span>${t.id === 'payments' ? 'Paid / Pending Dues' : t.label}</span></button>`).join('')}
            </nav>
          </div>
          <div class="side-user">
            <div class="avatar">${esc(initials(state.user.name))}</div>
            <div class="meta"><b>${esc(state.user.name)}</b><span>Administrator</span></div>
            <button class="icon-btn" data-action="logout" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div><h2 id="pageTitle"></h2><p id="pageSub"></p></div>
            <div style="display:flex;gap:8px;align-items:center">
              <span id="topAction"></span>
              <button class="btn bad sm mobile-logout" data-action="logout"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
          </div>
          <div id="content"></div>
        </main>
        <nav class="mobile-bar">
          ${ADMIN_TABS.map((t) => `<button data-action="adminTab" data-tab="${t.id}" id="mnav-${t.id}"><i class="fa-solid ${t.icon}"></i>${t.label.split(' ')[0]}</button>`).join('')}
        </nav>
      </div>`;
    switchAdminTab(state.tab);
  }

  actions.adminTab = (t) => switchAdminTab(t.dataset.tab);

  async function switchAdminTab(tab) {
    state.tab = tab;
    const meta = ADMIN_TABS.find((t) => t.id === tab);
    document.querySelectorAll('.nav button, .mobile-bar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#pageTitle').textContent = meta.id === 'payments' ? 'Payment Status & Billing' : meta.label;
    $('#pageSub').textContent = meta.sub;
    $('#topAction').innerHTML = '';
    destroyCharts();
    const c = $('#content');
    c.innerHTML = `<div class="skel-wrap">${'<div class="skel"></div>'.repeat(4)}</div>`;
    try {
      await ({ overview: tabOverview, members: tabMembers, trainers: tabTrainers, payments: tabPayments, plans: tabPlans }[tab])(c);
      runCounters(c);
    } catch (err) {
      c.innerHTML = `<div class="card empty"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`;
    }
  }

  /* ---------- OVERVIEW ---------- */
  async function tabOverview(c) {
    const s = await api('/admin/stats');
    const stats = [
      { l: 'Total Members', v: s.totalMembers, i: 'fa-users', c: '#4f8cff' },
      { l: 'Paid Members', v: s.paidMembers, i: 'fa-circle-check', c: '#34d399' },
      { l: 'Pending Dues', v: s.pendingMembers, i: 'fa-clock', c: '#fb7185' },
      { l: 'Total Trainers', v: s.totalTrainers, i: 'fa-user-ninja', c: '#8b5cf6' },
      { l: 'Total Revenue', v: s.totalRevenue, i: 'fa-sack-dollar', c: '#fbbf24', m: 1 },
      { l: 'Pending Amount', v: s.pendingAmount, i: 'fa-hourglass-half', c: '#f97316', m: 1 }
    ];
    c.innerHTML = `
      <div class="grid g-stats">
        ${stats.map((x, i) => `
          <div class="card stat hover anim-up" style="--i:${i};--c:${x.c}">
            <div class="ico"><i class="fa-solid ${x.i}"></i></div>
            <small>${x.l}</small>
            <div class="val" data-count="${x.v}" data-money="${x.m || 0}">0</div>
          </div>`).join('')}
      </div>
      <div class="grid g-2">
        <div class="card anim-up" style="--i:6"><h3><i class="fa-solid fa-chart-column" style="color:var(--accent)"></i> Revenue (last 6 months)</h3><div class="chart-box"><canvas id="revChart"></canvas></div></div>
        <div class="card anim-up" style="--i:7"><h3><i class="fa-solid fa-chart-pie" style="color:var(--accent-2)"></i> Payment Split</h3><div class="chart-box small"><canvas id="splitChart"></canvas></div></div>
      </div>
      <div class="card anim-up" style="--i:8;margin-top:18px">
        <h3><i class="fa-solid fa-receipt" style="color:var(--good)"></i> Recent Payments</h3>
        ${s.recent.length ? s.recent.map((p, i) => `
          <div class="list-row invoice" style="--i:${i}">
            <div class="cell-user"><div class="avatar">${esc(initials(p.member?.name))}</div><div><b>${esc(p.member?.name || 'Deleted member')}</b><span>${esc(p.invoiceNo)} &middot; ${fmtDate(p.paidAt)}</span></div></div>
            <b style="color:var(--good)">${money(p.amount)}</b>
          </div>`).join('') : '<div class="empty">No payments yet</div>'}
      </div>`;

    const ctx = $('#revChart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, '#6aa0ff'); grad.addColorStop(1, '#7c3aed');
    Chart.defaults.color = '#8b97b8';
    Chart.defaults.font.family = 'Inter';
    state.charts.rev = new Chart(ctx, {
      type: 'bar',
      data: { labels: s.revenue.map((m) => m.label), datasets: [{ label: 'Revenue', data: s.revenue.map((m) => m.total), backgroundColor: grad, borderRadius: 10, borderSkipped: false, maxBarThickness: 46 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1400, easing: 'easeOutQuart', delay: (c2) => c2.dataIndex * 120 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => ' ' + money(i.raw) }, backgroundColor: '#0b1020', padding: 12, cornerRadius: 10 } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { callback: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } } }
      }
    });
    state.charts.split = new Chart($('#splitChart'), {
      type: 'doughnut',
      data: { labels: ['Paid', 'Pending'], datasets: [{ data: [s.paidMembers, s.pendingMembers], backgroundColor: ['#34d399', '#fb7185'], borderWidth: 0, hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', animation: { animateRotate: true, duration: 1500 }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } }
    });
  }

  /* ---------- MEMBERS ---------- */
  async function loadRefs() {
    const [members, trainers] = await Promise.all([api('/admin/members'), api('/admin/trainers')]);
    state.members = members; state.trainers = trainers;
  }

  async function tabMembers(c) {
    await loadRefs();
    $('#topAction').innerHTML = `<button class="btn primary" data-action="addMember"><i class="fa-solid fa-user-plus"></i> Add Member</button>`;
    c.innerHTML = `
      <div class="card anim-fade">
        <div class="toolbar">
          <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="memberSearch" placeholder="Search by name, email or plan..." value="${esc(state.search)}"></div>
          <small style="color:var(--muted)" id="memberCount"></small>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Member</th><th>Plan</th><th>Coach</th><th>Amount</th><th>Due Date</th><th>Status</th><th class="right">Actions</th></tr></thead>
          <tbody id="membersBody"></tbody>
        </table></div>
      </div>`;
    drawMembers();
    $('#memberSearch').oninput = (e) => { state.search = e.target.value; drawMembers(); };
  }

  function drawMembers() {
    const q = state.search.toLowerCase().trim();
    const rows = state.members.filter((m) => !q || [m.name, m.email, m.plan, m.trainer?.name].some((v) => String(v || '').toLowerCase().includes(q)));
    $('#memberCount').textContent = `${rows.length} of ${state.members.length} members`;
    $('#membersBody').innerHTML = rows.length
      ? rows.map((m, i) => `
        <tr style="--i:${i}">
          <td><div class="cell-user"><div class="avatar">${esc(initials(m.name))}</div><div><b>${esc(m.name)}</b><span>${esc(m.email)}</span></div></div></td>
          <td>${esc(m.plan)}</td>
          <td>${esc(m.trainer?.name || 'Unassigned')}</td>
          <td><b>${money(m.amount)}</b></td>
          <td style="color:var(--muted)">${fmtDate(m.dueDate)}</td>
          <td>${badge(m.status)}</td>
          <td class="right"><span class="actions">
            <button class="btn sm" data-action="editMember" data-id="${m._id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn sm bad" data-action="deleteMember" data-id="${m._id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </span></td>
        </tr>`).join('')
      : `<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-user-slash"></i>No members found</div></td></tr>`;
  }

  function memberForm(m = {}) {
    const trainerOpts = ['<option value="">Unassigned</option>']
      .concat(state.trainers.map((t) => `<option value="${t._id}" ${String(m.trainer?._id || m.trainer) === t._id ? 'selected' : ''}>${esc(t.name)}</option>`)).join('');
    const plans = ['Monthly Pass', 'VIP Monthly Pass', 'Quarterly Pass', 'Yearly Pass'];
    return `
      <div class="form-grid">
        <div class="field full"><label>Full Name</label><input name="name" required value="${esc(m.name)}"></div>
        <div class="field"><label>Email</label><input name="email" type="email" required value="${esc(m.email)}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(m.phone)}"></div>
        <div class="field full"><label>Password ${m._id ? '(leave blank to keep current)' : ''}</label><input name="password" type="password" minlength="6" ${m._id ? '' : 'required'} placeholder="Min 6 characters"></div>
        <div class="field"><label>Plan</label><select name="plan">${plans.map((p) => `<option ${m.plan === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>Coach</label><select name="trainer">${trainerOpts}</select></div>
        <div class="field"><label>Fee (${CUR.trim()})</label><input name="amount" type="number" min="0" required value="${m.amount ?? 5000}"></div>
        <div class="field"><label>Due Date</label><input name="dueDate" type="date" required value="${toInput(m.dueDate || Date.now() + 30 * 864e5)}"></div>
        <div class="field full"><label>Payment Status</label><select name="status"><option ${m.status !== 'Paid' ? 'selected' : ''}>Pending</option><option ${m.status === 'Paid' ? 'selected' : ''}>Paid</option></select></div>
      </div>`;
  }

  actions.addMember = () => openModal('Add Member', memberForm(), async (d) => {
    await api('/admin/members', { method: 'POST', body: d });
    toast('Member added'); switchAdminTab('members');
  }, 'Add Member');
  actions.editMember = (t) => {
    const m = state.members.find((x) => x._id === t.dataset.id);
    openModal('Edit Member', memberForm(m), async (d) => {
      if (!d.password) delete d.password;
      await api('/admin/members/' + m._id, { method: 'PUT', body: d });
      toast('Member updated'); switchAdminTab('members');
    });
  };
  actions.deleteMember = (t) => {
    const m = state.members.find((x) => x._id === t.dataset.id);
    openModal('Delete Member', `<p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:14px">Are you sure you want to delete <b style="color:#fff">${esc(m.name)}</b>? Their payment history will also be removed. This cannot be undone.</p>`, async () => {
      await api('/admin/members/' + m._id, { method: 'DELETE' });
      toast('Member deleted'); switchAdminTab('members');
    }, 'Delete');
  };

  /* ---------- TRAINERS ---------- */
  async function tabTrainers(c) {
    state.trainers = await api('/admin/trainers');
    $('#topAction').innerHTML = `<button class="btn primary" data-action="addTrainer"><i class="fa-solid fa-plus"></i> Add Trainer</button>`;
    c.innerHTML = state.trainers.length
      ? `<div class="grid g-cards">${state.trainers.map((t, i) => `
          <div class="card hover trainer anim-up" style="--i:${i}">
            <div class="top"><div class="avatar">${esc(initials(t.name))}</div><div><h4>${esc(t.name)}</h4><div class="tag">${esc(t.specialty)}</div></div></div>
            <div class="info"><span>Experience <b>${esc(t.exp)}</b></span><span>Members <b>${t.members}</b></span></div>
            <div class="btns">
              <button class="btn sm w100" data-action="editTrainer" data-id="${t._id}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn sm bad" data-action="deleteTrainer" data-id="${t._id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`).join('')}</div>`
      : `<div class="card empty"><i class="fa-solid fa-user-ninja"></i>No trainers yet. Add your first coach!</div>`;
  }
  const trainerForm = (t = {}) => `
    <div class="field"><label>Trainer Name</label><input name="name" required value="${esc(t.name)}"></div>
    <div class="field"><label>Specialization</label><input name="specialty" required placeholder="e.g. Bodybuilding" value="${esc(t.specialty)}"></div>
    <div class="field"><label>Experience</label><input name="exp" required placeholder="e.g. 5 Years" value="${esc(t.exp)}"></div>`;
  actions.addTrainer = () => openModal('Add Trainer', trainerForm(), async (d) => {
    await api('/admin/trainers', { method: 'POST', body: d }); toast('Trainer added'); switchAdminTab('trainers');
  }, 'Save Trainer');
  actions.editTrainer = (t) => {
    const tr = state.trainers.find((x) => x._id === t.dataset.id);
    openModal('Edit Trainer', trainerForm(tr), async (d) => {
      await api('/admin/trainers/' + tr._id, { method: 'PUT', body: d }); toast('Trainer updated'); switchAdminTab('trainers');
    }, 'Save Trainer');
  };
  actions.deleteTrainer = (t) => {
    const tr = state.trainers.find((x) => x._id === t.dataset.id);
    openModal('Delete Trainer', `<p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:14px">Remove <b style="color:#fff">${esc(tr.name)}</b>? Their ${tr.members} member(s) will become unassigned.</p>`, async () => {
      await api('/admin/trainers/' + tr._id, { method: 'DELETE' }); toast('Trainer removed'); switchAdminTab('trainers');
    }, 'Delete');
  };

  /* ---------- PAYMENTS ---------- */
  async function tabPayments(c) {
    const [rows, history] = await Promise.all([
      api('/admin/payments' + (state.payFilter !== 'ALL' ? '?status=' + state.payFilter : '')),
      api('/admin/payments/history')
    ]);
    const pills = [['ALL', 'All'], ['Paid', 'Paid'], ['Pending', 'Pending']];
    c.innerHTML = `
      <div class="card anim-fade">
        <div class="toolbar">
          <div class="pills">${pills.map(([v, l]) => `<button class="${state.payFilter === v ? 'on' : ''}" data-action="payFilter" data-v="${v}">${l}</button>`).join('')}</div>
          <small style="color:var(--muted)">${rows.length} record(s)</small>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Member</th><th>Amount</th><th>Due Date</th><th>Status</th><th class="right">Action</th></tr></thead>
          <tbody>${rows.length ? rows.map((m, i) => `
            <tr style="--i:${i}">
              <td><div class="cell-user"><div class="avatar">${esc(initials(m.name))}</div><div><b>${esc(m.name)}</b><span>${esc(m.plan)}</span></div></div></td>
              <td><b>${money(m.amount)}</b></td>
              <td style="color:var(--muted)">${fmtDate(m.dueDate)}</td>
              <td>${badge(m.status)}</td>
              <td class="right">${m.status === 'Pending'
                ? `<button class="btn sm good" data-action="markPaid" data-id="${m._id}"><i class="fa-solid fa-check"></i> Mark Paid</button>`
                : `<span style="color:var(--muted);font-size:12px">Cleared</span> <button class="btn sm" data-action="markUnpaid" data-id="${m._id}" title="Revert to pending"><i class="fa-solid fa-rotate-left"></i></button>`}</td>
            </tr>`).join('') : `<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-wallet"></i>Nothing here</div></td></tr>`}
          </tbody>
        </table></div>
      </div>
      <div class="card anim-up" style="margin-top:18px;--i:2">
        <h3><i class="fa-solid fa-receipt" style="color:var(--good)"></i> Receipt History</h3>
        ${history.length ? history.map((p, i) => `
          <div class="list-row invoice" style="--i:${i}">
            <div><b>${esc(p.invoiceNo)}</b><small>${esc(p.member?.name || 'Deleted member')} &middot; ${fmtDate(p.paidAt)}</small></div>
            <b style="color:var(--good)">${money(p.amount)}</b>
          </div>`).join('') : '<div class="empty">No receipts yet</div>'}
      </div>`;
  }
  actions.payFilter = (t) => { state.payFilter = t.dataset.v; switchAdminTab('payments'); };
  actions.markPaid = async (t) => {
    t.disabled = true;
    try { await api(`/admin/payments/${t.dataset.id}/pay`, { method: 'POST' }); toast('Payment recorded, receipt generated'); switchAdminTab('payments'); }
    catch (e) { toast(e.message, 'err'); t.disabled = false; }
  };
  actions.markUnpaid = async (t) => {
    try { await api(`/admin/payments/${t.dataset.id}/unpay`, { method: 'POST' }); toast('Marked as pending', 'info'); switchAdminTab('payments'); }
    catch (e) { toast(e.message, 'err'); }
  };

  /* ---------- WEEKLY PLANS ---------- */
  const todayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
  async function tabPlans(c) {
    const plans = await api('/admin/plans');
    c.innerHTML = `<div class="grid g-days">${plans.map((p, i) => `
      <div class="card day-card hover anim-up ${p.day === todayName() ? 'today' : ''}" style="--i:${i}" data-day="${p.day}">
        <div class="day"><span>${p.day}</span>${p.day === todayName() ? '<span class="today-chip">TODAY</span>' : ''}</div>
        <div class="field"><label><i class="fa-solid fa-dumbbell"></i> Workout</label><input name="workout" value="${esc(p.workout)}"></div>
        <div class="field"><label><i class="fa-solid fa-apple-whole"></i> Diet</label><input name="diet" value="${esc(p.diet)}"></div>
        <button class="btn sm good w100" data-action="savePlan" data-day="${p.day}"><i class="fa-solid fa-floppy-disk"></i> Save ${p.day}</button>
      </div>`).join('')}</div>`;
  }
  actions.savePlan = async (t) => {
    const card = t.closest('.day-card');
    const body = { workout: $('[name=workout]', card).value, diet: $('[name=diet]', card).value };
    const label = t.innerHTML;
    setBtnLoading(t, true);
    try { await api('/admin/plans/' + t.dataset.day, { method: 'PUT', body }); toast(`${t.dataset.day} plan saved`); }
    catch (e) { toast(e.message, 'err'); }
    setBtnLoading(t, false, label);
  };

  /* ================= MEMBER PORTAL ================= */
  async function renderMember() {
    app.innerHTML = `<div class="member-wrap"><div class="skel" style="height:150px"></div></div>`;
    let data;
    try { data = await api('/member/dashboard'); } catch (e) { toast(e.message, 'err'); return; }
    const { user, plans, invoices } = data;
    const today = todayName();
    const todayPlan = plans.find((p) => p.day === today);
    const daysLeft = Math.ceil((new Date(user.dueDate) - Date.now()) / 864e5);
    const paid = user.status === 'Paid';
    const circ = 2 * Math.PI * 34;
    const pct = paid ? Math.max(0.04, Math.min(daysLeft / 30, 1)) : 0.04;
    const ringColor = paid ? '#fff' : '#fecaca';

    app.innerHTML = `
      <div class="member-wrap">
        <div class="member-top">
          <div class="brand"><div class="logo"><i class="fa-solid fa-dumbbell"></i></div><div><strong>FitPulse</strong><p>Member Portal</p></div></div>
          <button class="btn bad sm" data-action="logout"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
        </div>

        <div class="hero">
          <div class="who">
            <div class="avatar">${esc(initials(user.name))}</div>
            <div>
              <h2>${esc(user.name)}</h2>
              <p>Membership: <b>${esc(user.plan)}</b></p>
              <p>Assigned Coach: <b>${esc(user.trainer?.name || 'Not assigned yet')}</b></p>
            </div>
          </div>
          <div class="ring-box">
            <div class="ring" style="--circ:${circ};--off:${circ * (1 - pct)}">
              <svg width="78" height="78" viewBox="0 0 78 78"><circle class="bgc" cx="39" cy="39" r="34"/><circle class="fg" cx="39" cy="39" r="34" stroke="${ringColor}"/></svg>
              <div class="num"><div>${paid ? Math.max(daysLeft, 0) : '!'}<small>${paid ? 'days left' : 'overdue'}</small></div></div>
            </div>
            <div class="txt">
              <small>Payment Status</small>
              <span class="badge">${paid ? 'PAID (Active)' : 'PENDING DUES'}</span>
              <small style="margin-top:6px">${paid ? 'Renews' : 'Was due'} ${fmtDate(user.dueDate)}</small>
            </div>
          </div>
        </div>

        ${todayPlan ? `
        <div class="today-card anim-up" style="--i:2">
          <div class="w"><i class="fa-solid fa-fire big"></i><small>Today's Workout &middot; ${today}</small><h4>${esc(todayPlan.workout)}</h4></div>
          <div class="d"><i class="fa-solid fa-bowl-food big"></i><small>Today's Diet</small><h4 style="font-size:16px;line-height:1.4">${esc(todayPlan.diet)}</h4></div>
        </div>` : ''}

        <div class="grid g-eq">
          <div class="card anim-up" style="--i:3">
            <h3 style="color:var(--accent)"><i class="fa-solid fa-calendar-day"></i> My Weekly Workout Routine</h3>
            ${plans.map((p, i) => `<div class="list-row ${p.day === today ? 'today' : ''}" style="--i:${i}"><span class="dname" style="color:var(--accent)">${p.day}</span><span class="grow">${esc(p.workout)}</span>${p.day === today ? '<span class="today-chip">TODAY</span>' : ''}</div>`).join('')}
          </div>
          <div class="card anim-up" style="--i:4">
            <h3 style="color:var(--good)"><i class="fa-solid fa-utensils"></i> My Daily Diet Plan</h3>
            ${plans.map((p, i) => `<div class="list-row ${p.day === today ? 'today' : ''}" style="--i:${i}"><span class="dname" style="color:var(--good)">${p.day}</span><span class="grow">${esc(p.diet)}</span></div>`).join('')}
          </div>
        </div>

        <div class="grid g-eq" style="margin-top:18px">
          <div class="card anim-up" style="--i:5">
            <h3 style="color:#c084fc"><i class="fa-solid fa-receipt"></i> My Fee Payment Receipts</h3>
            ${invoices.length ? invoices.map((p, i) => `
              <div class="list-row invoice" style="--i:${i}">
                <div><b>${esc(p.invoiceNo)}</b><small>Date: ${fmtDate(p.paidAt)}</small></div>
                <b style="color:var(--good)">${money(p.amount)} (PAID)</b>
              </div>`).join('') : '<div class="empty"><i class="fa-solid fa-file-invoice"></i>No receipts yet</div>'}
          </div>
          <div class="card anim-up" style="--i:6">
            <h3 style="color:var(--warn)"><i class="fa-solid fa-user-ninja"></i> My Coach</h3>
            ${user.trainer ? `
              <div class="coach"><div class="avatar">${esc(initials(user.trainer.name))}</div>
              <div><b style="font-size:17px">${esc(user.trainer.name)}</b><div style="color:var(--accent);font-size:12px;font-weight:600;margin:3px 0">${esc(user.trainer.specialty)}</div><div style="color:var(--muted);font-size:12px">Experience: ${esc(user.trainer.exp)}</div></div></div>`
              : '<div class="empty"><i class="fa-solid fa-user-clock"></i>A coach will be assigned to you soon</div>'}
            <div style="margin-top:18px"><button class="btn w100" data-action="editProfile"><i class="fa-solid fa-user-pen"></i> Edit My Profile</button></div>
          </div>
        </div>
      </div>`;
    state.memberUser = user;
  }

  actions.editProfile = () => {
    const u = state.memberUser;
    openModal('Edit My Profile', `
      <div class="field"><label>Full Name</label><input name="name" required value="${esc(u.name)}"></div>
      <div class="field"><label>Phone</label><input name="phone" value="${esc(u.phone)}"></div>
      <div class="field"><label>New Password (optional)</label><input name="password" type="password" minlength="6" placeholder="Leave blank to keep current"></div>`,
      async (d) => {
        if (!d.password) delete d.password;
        const updated = await api('/member/profile', { method: 'PUT', body: d });
        state.user = updated;
        toast('Profile updated');
        renderMember();
      });
  };

  /* ================= START ================= */
  boot();
})();
