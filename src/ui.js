/* ---------- state ---------- */
let data = seedData();
let currentUser = data.users[0];        // default: the executive
let searchTerm = '';
let selectedArtistId = null;            // roster drill-down
let pendingConfirm = null;              // release id awaiting approve-with-risks confirm

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'roster', label: 'Artists & Rights' },
  { id: 'truthcheck', label: 'Numbers Check' },
  { id: 'analytics', label: 'Trends & Radio' },
];

/* ---------- helpers ---------- */
const fmt = new Intl.NumberFormat('en-US');
const money = (n) => '$' + fmt.format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shortNum = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v));
const flag = (ok) => ok ? '<span class="badge b-good">on file</span>' : '<span class="badge b-crit">missing</span>';

const STATUS_CLASS = {
  live: 'b-good', approved: 'b-good', scheduled: 'b-info',
  executive_review: 'b-warn', splits_review: 'b-warn', asset_review: 'b-warn', metadata_review: 'b-warn',
  draft: 'b-muted', archived: 'b-muted', rejected: 'b-crit',
};
const statusBadge = (s) => `<span class="badge ${STATUS_CLASS[s] || 'b-muted'}">${s.replace(/_/g, ' ')}</span>`;

function currentView() {
  const id = location.hash.replace(/^#\//, '') || 'overview';
  return VIEWS.some(v => v.id === id) ? id : 'overview';
}

// Everything the active role is allowed to see.
function scopedData() {
  const artists = visibleArtists(data, currentUser);
  const artistIds = new Set(artists.map(a => a.id));
  const songs = data.songs.filter(s => artistIds.has(s.artistId));
  const songIds = new Set(songs.map(s => s.id));
  const releases = data.releases.filter(r => artistIds.has(r.artistId));
  const releaseIds = new Set(releases.map(r => r.id));
  return {
    artists, songs, releases,
    metrics: data.metrics.filter(m => releaseIds.has(m.releaseId)),
    airplaySpins: data.airplaySpins.filter(sp => songIds.has(sp.songId)),
    auditLog: data.auditLog,
  };
}

/* ---------- views ---------- */
function viewPlaceholder(title) {
  return `<h1>${title}</h1><p class="empty">View under construction.</p>`;
}

function viewOverview() {
  const sd = scopedData();
  const k = kpis(sd);
  const alerts = computeRiskAlerts(sd);
  const cards = [
    ['Artists', fmt.format(k.artists)],
    ['Releases', fmt.format(k.releases)],
    ['Pending approvals', fmt.format(k.pendingApprovals)],
    ['Scheduled', fmt.format(k.scheduled)],
    ['Live', fmt.format(k.live)],
    ['Revenue', money(k.revenue)],
  ].map(([label, val]) => `<div class="card kpi"><div class="kpi-val">${val}</div><div class="kpi-label">${label}</div></div>`).join('');

  const alertRows = alerts.length
    ? alerts.map(a => `<a class="alert" href="#/${a.view}" ${a.view === 'roster' ? `data-action="goto-artist" data-id="${a.targetId}"` : ''}>
        <span class="badge ${a.severity === 'high' ? 'b-crit' : 'b-warn'}">${a.severity}</span><span>${esc(a.message)}</span></a>`).join('')
    : '<p class="empty">No open risks.</p>';

  const recent = data.auditLog.slice(0, 5).map(a =>
    `<li>${esc(a.actor)} (${a.role.replace('_', ' ')}): ${esc(a.action)}</li>`).join('');

  return `<h1>Overview</h1>
    <div class="kpi-grid">${cards}</div>
    <div class="card"><h2>Risk Alerts</h2><p class="muted">Anything that needs your attention — missing paperwork, split problems, or numbers that don’t add up.</p>${alertRows}</div>
    <div class="card"><h2>Recent actions</h2>${recent ? `<ul class="blockers">${recent}</ul>` : '<p class="empty">No actions yet this session.</p>'}</div>`;
}

function viewSearch() {
  const q = searchTerm.trim().toLowerCase();
  const sd = scopedData();
  const artists = sd.artists.filter(a => a.name.toLowerCase().includes(q));
  const songs = sd.songs.filter(s => s.title.toLowerCase().includes(q));
  const releases = sd.releases.filter(r => r.title.toLowerCase().includes(q));
  const section = (title, rows) => rows.length ? `<div class="card"><h2>${title}</h2>${rows.join('')}</div>` : '';
  return `<h1>Search: "${esc(searchTerm)}"</h1>
    ${section('Artists', artists.map(a => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${a.id}"><span>${esc(a.name)}</span><span class="muted">${esc(a.genre)}</span></a>`))}
    ${section('Releases', releases.map(r => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${r.artistId}"><span>${esc(r.title)}</span>${statusBadge(r.status)}</a>`))}
    ${section('Songs', songs.map(s => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${s.artistId}"><span>${esc(s.title)}</span><span class="muted">${esc(data.artists.find(a => a.id === s.artistId).name)}</span></a>`))}
    ${!artists.length && !songs.length && !releases.length ? '<p class="empty">Nothing in your scope matches.</p>' : ''}`;
}

function viewApprovals() {
  const sd = scopedData();
  const queue = sd.releases.filter(r => r.status === 'executive_review');
  const decided = sd.releases.filter(r => ['approved', 'rejected'].includes(r.status));
  const decidedRows = decided.map(r =>
    `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${r.artistId}"><span>${esc(r.title)}</span>${statusBadge(r.status)}</a>`).join('');
  return `<h1>Approvals</h1>
    ${queue.length ? queue.map(r => approvalCard(r, sd)).join('') : '<p class="empty">Nothing awaiting executive review.</p>'}
    ${decided.length ? `<div class="card"><h2>Decided this session</h2>${decidedRows}</div>` : ''}`;
}

function approvalCard(r, sd) {
  const artist = data.artists.find(a => a.id === r.artistId);
  const c = releaseCompleteness(r, data.songs);
  const checks = [['Metadata', c.metadata], ['Assets', c.assets], ['Splits', c.splits], ['Contracts', c.contracts]]
    .map(([label, ok]) => `<span class="badge ${ok ? 'b-good' : 'b-crit'}">${ok ? '✓' : '✗'} ${label}</span>`).join(' ');
  const blockers = c.blockers.length
    ? `<ul class="blockers">${c.blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';

  let actions;
  if (!canDecide(currentUser.role)) {
    actions = `<p class="muted">Viewing as ${currentUser.role.replace('_', ' ')} — approval decisions are reserved for executives.</p>`;
  } else if (pendingConfirm === r.id && c.blockers.length) {
    actions = `<div class="confirm-row">
      <span class="warn-text">Approving with ${c.blockers.length} open risk(s) — this will be logged.</span>
      <button class="btn btn-warn" data-action="decide" data-id="${r.id}" data-decision="approve">Confirm Approve</button>
      <button class="btn" data-action="cancel-confirm">Cancel</button></div>`;
  } else {
    actions = `<div class="actions">
      <button class="btn btn-good" data-action="${c.blockers.length ? 'ask-confirm' : 'decide'}" data-id="${r.id}" data-decision="approve">Approve</button>
      <button class="btn btn-crit" data-action="decide" data-id="${r.id}" data-decision="reject">Reject</button></div>`;
  }

  // r.type / r.releaseDate / r.territories are unescaped ONLY because they are
  // trusted enums/generated values in the seed. Any field that becomes
  // user-supplied must go through esc().
  return `<div class="card">
    <div class="card-head"><h2>${esc(r.title)}</h2>${statusBadge(r.status)}</div>
    <p class="muted">${esc(artist.name)} · ${r.type} · target ${r.releaseDate} · ${r.territories.join(', ')}</p>
    <div class="checks">${checks}</div>${blockers}${actions}</div>`;
}

function viewRoster() {
  const sd = scopedData();
  if (selectedArtistId) {
    const artist = sd.artists.find(a => a.id === selectedArtistId);
    if (artist) return artistDetail(artist, sd);
    selectedArtistId = null; // out of scope for this role
  }
  const rows = sd.artists.map(a => {
    const releases = sd.releases.filter(r => r.artistId === a.id);
    const songs = sd.songs.filter(s => s.artistId === a.id);
    const openIssues = songs.reduce((n, s) => n + assetProtection(s).issues.length, 0);
    const pipeline = releases.filter(r => !['live', 'archived', 'rejected'].includes(r.status)).length;
    return `<tr>
      <td>${esc(a.name)}</td><td>${esc(a.genre)}</td>
      <td class="num">${releases.filter(r => r.status === 'live').length}</td>
      <td class="num">${pipeline}</td>
      <td>${openIssues ? `<span class="badge b-warn">${openIssues} open</span>` : '<span class="badge b-good">clear</span>'}</td>
      <td><button class="btn btn-sm" data-action="goto-artist" data-id="${a.id}">Open</button></td></tr>`;
  }).join('');
  return `<h1>Artists & Rights</h1>
    <table class="tbl"><thead><tr><th>Artist</th><th>Genre</th><th>Live</th><th>In pipeline</th><th>IP issues</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function artistDetail(artist, sd) {
  const songs = sd.songs.filter(s => s.artistId === artist.id);
  const cards = songs.map(s => {
    const ap = assetProtection(s);
    const total = splitsTotal(s);
    const splitRows = s.splits.map(c => `<tr>
      <td>${esc(c.name)}</td><td>${esc(c.role)}</td><td class="num">${c.pct}%</td>
      <td>${c.approved ? '<span class="badge b-good">approved</span>' : '<span class="badge b-warn">pending</span>'}</td></tr>`).join('');
    const totalRow = `<tr class="${total === 100 ? '' : 'row-bad'}">
      <td colspan="2"><strong>Total</strong></td><td class="num"><strong>${total}%</strong></td>
      <td>${total === 100 ? '' : '<span class="badge b-crit">must equal 100%</span>'}</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h3>${esc(s.title)}</h3><span class="badge grade-${ap.grade}">IP grade ${ap.grade} · ${ap.score}/100</span></div>
      <p class="muted">ISRC: ${s.isrc ? esc(s.isrc) : '<span class="badge b-crit">missing</span>'} ·
        Master: ${esc(s.masterOwner)} · Publishing: ${esc(s.publishingOwner)}</p>
      <p class="muted">Producer agreement: ${flag(s.producerAgreementOnFile)} · Split sheet: ${flag(s.splitSheetOnFile)}</p>
      <table class="tbl"><thead><tr><th>Contributor</th><th>Role</th><th>Split</th><th>Status</th></tr></thead>
      <tbody>${splitRows}${totalRow}</tbody></table>
      ${ap.issues.length
        ? `<div class="scorecard"><strong>Asset-protection issues</strong><ul>${ap.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`
        : '<p class="good-text">Fully protected: masters, publishing, and paper all in order.</p>'}
    </div>`;
  }).join('');
  return `<button class="btn btn-sm" data-action="back">← Roster</button>
    <h1>${esc(artist.name)}</h1><p class="muted">${esc(artist.genre)}</p>${cards}`;
}

function viewTruthcheck() {
  const sd = scopedData();
  if (!sd.metrics.length) return '<h1>Numbers Check</h1><p class="empty">No reported metrics in scope.</p>';
  const cards = sd.metrics.map(m => {
    const release = data.releases.find(r => r.id === m.releaseId);
    const t = truthCheck(m);
    const badge = t.verdict === 'verified' ? '<span class="badge b-good">Verified</span>'
      : t.verdict === 'questionable' ? '<span class="badge b-warn">Questionable</span>'
      : '<span class="badge b-crit">Impossible math</span>';
    const stats = [
      ['Reported streams', fmt.format(m.reportedStreams)],
      ['Unique listeners', fmt.format(m.uniqueListeners)],
      ['Physical + repeat purchases', fmt.format(m.physicalSales + m.repeatPurchases)],
      ['Fan-equity conversion', (t.fanEquity * 100).toFixed(2) + '%'],
      ['Shipped units', fmt.format(m.shippedUnits)],
      ['Verified sales', fmt.format(m.verifiedSales)],
    ].map(([label, val]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-val">${val}</span></div>`).join('');
    const flags = t.flags.length
      ? `<ul class="blockers">${t.flags.map(f => `<li class="${f.level === 'fraud' ? 'crit-text' : 'warn-text'}">${esc(f.text)}</li>`).join('')}</ul>`
      : '<p class="good-text">Numbers are internally consistent and backed by real fan equity.</p>';
    return `<div class="card"><div class="card-head"><h2>${esc(release.title)}</h2>${badge}</div>
      <div class="stat-grid">${stats}</div>${flags}</div>`;
  }).join('');
  return `<h1>Numbers Check</h1>
    <p class="muted">We check every release’s numbers for anything that doesn’t add up.</p>
    ${cards}`;
}

function lineChart({ points, w = 640, h = 200, label }) {
  const pad = { l: 46, r: 12, t: 12, b: 24 };
  const max = Math.max(...points.map(p => p.value));
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const gridLines = [0, 0.5, 1].map(f => {
    const v = max * f;
    return `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
      <text class="tick" x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${shortNum(v)}</text>`;
  }).join('');
  const dots = points.map((p, i) =>
    `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3"><title>${esc(p.label)}: ${fmt.format(p.value)}</title></circle>`).join('');
  const xLabels = points.map((p, i) =>
    `<text class="tick" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(p.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${gridLines}<path class="series-line" d="${path}"/>${dots}${xLabels}</svg>`;
}

function barChartH({ rows, label, color = 'var(--series-1)' }) {
  const max = Math.max(...rows.map(r => r.value));
  const bars = rows.map(r => `<div class="hbar-row">
    <span class="hbar-label">${esc(r.label)}</span>
    <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || color}"></div></div>
    <span class="hbar-val">${fmt.format(r.value)}</span></div>`).join('');
  return `<div role="img" aria-label="${esc(label)}">${bars}</div>`;
}

function viewAnalytics() {
  const sd = scopedData();
  const streams = sd.metrics.reduce((t, m) => t + m.reportedStreams, 0);
  const saves = sd.metrics.reduce((t, m) => t + m.saves, 0);
  const purchases = sd.metrics.reduce((t, m) => t + m.physicalSales + m.repeatPurchases, 0);
  const funnel = barChartH({
    label: 'Fan-equity funnel: streams to saves to purchases',
    rows: [
      { label: 'Streams', value: streams, color: '#86b6ef' },
      { label: 'Saves', value: saves, color: '#2a78d6' },
      { label: 'Purchases', value: purchases, color: '#184f95' },
    ],
  });
  const byStation = {};
  for (const sp of sd.airplaySpins) byStation[sp.station] = (byStation[sp.station] || 0) + 1;
  const stationRows = Object.entries(byStation)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const spinRows = sd.airplaySpins.map(sp => {
    const song = data.songs.find(s => s.id === sp.songId);
    return `<tr><td>${esc(song.title)}</td><td>${esc(sp.station)}</td><td>${esc(sp.market)}</td>
      <td>${sp.playedAt}</td><td>${esc(sp.sourceType)}</td><td>${esc(sp.detectionMethod)}</td>
      <td class="num">${fmt.format(sp.estAudience)}</td><td class="num">${Math.round(sp.confidence * 100)}%</td></tr>`;
  }).join('');
  return `<h1>Trends & Radio</h1>
    <div class="card"><h2>Monthly streams — all artists (sample data)</h2>
      ${lineChart({ points: data.trend, label: 'Monthly streams, trailing eight months' })}</div>
    <div class="chart-row">
      <div class="card"><h2>Fan-equity funnel</h2>
        <p class="muted">Of everyone who streamed, how many saved the song — and how many actually bought it.</p>${funnel}</div>
      <div class="card"><h2>Spins by station</h2>
        ${stationRows.length ? barChartH({ label: 'Airplay spins by station', rows: stationRows }) : '<p class="empty">No spins in scope.</p>'}</div>
    </div>
    <div class="card"><h2>Recent spins</h2>
      <p class="muted">Every radio play shows where the report came from and how it was verified.</p>
      <table class="tbl"><thead><tr><th>Song</th><th>Station</th><th>Market</th><th>Date</th><th>Source</th><th>Detection</th><th>Est. audience</th><th>Confidence</th></tr></thead>
      <tbody>${spinRows}</tbody></table></div>`;
}

const renderers = {
  overview: viewOverview,
  approvals: viewApprovals,
  roster: viewRoster,
  truthcheck: viewTruthcheck,
  analytics: viewAnalytics,
};

/* ---------- rendering ---------- */
function renderNav() {
  document.getElementById('nav').innerHTML = VIEWS.map(v =>
    `<a href="#/${v.id}" class="${!searchTerm && currentView() === v.id ? 'active' : ''}">${v.label}</a>`).join('');
}

function renderTopbar() {
  document.getElementById('whoami').innerHTML =
    `${esc(currentUser.name)} <span class="badge b-info">${currentUser.role.replace('_', ' ')}</span>`;
}

function renderAudit() {
  document.getElementById('auditList').innerHTML = data.auditLog.length
    ? data.auditLog.map(a => `<li><span class="muted">${a.at.slice(0, 19).replace('T', ' ')}</span><br>${esc(a.actor)} (${a.role.replace('_', ' ')}): ${esc(a.action)}</li>`).join('')
    : '<li class="muted">No actions recorded this session.</li>';
}

function render() {
  renderNav();
  renderTopbar();
  renderAudit();
  document.getElementById('view').innerHTML = searchTerm.trim() ? viewSearch() : renderers[currentView()]();
}

/* ---------- events ---------- */
function onClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'audit') {
    const d = document.getElementById('auditDrawer');
    d.hidden = !d.hidden;
  } else if (action === 'goto-artist') {
    e.preventDefault();
    selectedArtistId = t.dataset.id;
    if (currentView() !== 'roster' || searchTerm) {
      searchTerm = '';
      document.getElementById('search').value = '';
      if (location.hash !== '#/roster') { location.hash = '#/roster'; return; }
    }
    render();
  } else if (action === 'ask-confirm') {
    pendingConfirm = t.dataset.id;
    render();
  } else if (action === 'cancel-confirm') {
    pendingConfirm = null;
    render();
  } else if (action === 'decide') {
    const res = decideRelease(data, t.dataset.id, t.dataset.decision, currentUser);
    pendingConfirm = null;
    if (res.ok) render();
  } else if (action === 'back') {
    selectedArtistId = null;
    render();
  }
}

function boot() {
  const roleSel = document.getElementById('roleSwitch');
  roleSel.innerHTML = data.users.map(u =>
    `<option value="${u.id}">${esc(u.name)} — ${u.role.replace('_', ' ')}</option>`).join('');
  roleSel.addEventListener('change', () => {
    currentUser = data.users.find(u => u.id === roleSel.value);
    selectedArtistId = null;
    pendingConfirm = null;
    render();
  });
  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });
  window.addEventListener('hashchange', () => {
    searchTerm = '';
    document.getElementById('search').value = '';
    render();
  });
  document.addEventListener('click', onClick);
  render();
}

boot();
