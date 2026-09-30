/**
 * admin-dashboard.js — powers the admin-only dashboard
 * Sees ALL entries from all agents.
 */

function escapeAttr(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replace(/"/g, '&quot;');
}

// Auth guard — admin only
const _adminSession = Auth.requireAdmin('../login.html');

let activeFilter = 'all';
let chartInstance = null;

// Log view state: one day at a time by default, whole month on request.
// Dates are kept as local-time strings ("YYYY-MM-DD" / "YYYY-MM") so they
// line up with entryTime, which is a local datetime-local value.
let viewMode = 'day';
let lastAll = [];

function pad2(n) { return String(n).padStart(2, '0'); }
function localDateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
let selectedDate  = localDateKey(new Date());
let selectedMonth = selectedDate.slice(0, 7);
let reportMonth   = selectedMonth;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logDate').value     = selectedDate;
  document.getElementById('logMonth').value    = selectedMonth;
  document.getElementById('reportMonth').value = reportMonth;
  render();
  setInterval(render, 15000);
});

async function render() {
  const all      = await Store.getAll();
  lastAll        = all;
  const filtered = filterByPeriod(filterEntries(all, activeFilter));
  const s        = Store.stats(all);

  updateKPIs(s, all);
  updateChart(all);
  updateBreakdown(s, all);
  renderAgentSummaries(all);
  renderTable(filtered);
  updateReportPreview();
  updateTimestamp();
}

function entryDateKey(e) { return String(e.entryTime || '').slice(0, 10); }

function filterByPeriod(entries) {
  if (viewMode === 'month') return entries.filter(e => entryDateKey(e).slice(0, 7) === selectedMonth);
  return entries.filter(e => entryDateKey(e) === selectedDate);
}

function niceDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function niceMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('v-day').classList.toggle('active', mode === 'day');
  document.getElementById('v-month').classList.toggle('active', mode === 'month');
  document.getElementById('dayControls').style.display   = mode === 'day' ? 'flex' : 'none';
  document.getElementById('monthControls').style.display = mode === 'month' ? 'flex' : 'none';
  if (mode === 'month') {
    // Start the month view on the month of the day being looked at.
    selectedMonth = selectedDate.slice(0, 7);
    document.getElementById('logMonth').value = selectedMonth;
  }
  render();
}
function setLogDate(v) {
  if (!v) return;
  selectedDate = v;
  render();
}
function setLogMonth(v) {
  if (!v) return;
  selectedMonth = v;
  render();
}
function shiftDay(n) {
  const [y, m, d] = selectedDate.split('-').map(Number);
  selectedDate = localDateKey(new Date(y, m - 1, d + n));
  document.getElementById('logDate').value = selectedDate;
  render();
}
function goToday() {
  selectedDate = localDateKey(new Date());
  document.getElementById('logDate').value = selectedDate;
  render();
}

function filterEntries(entries, filter) {
  if (filter === 'all')    return entries;
  if (filter === 'merez')  return entries.filter(e => e.station === 'merez');
  if (filter === 'rubis')  return entries.filter(e => e.station === 'rubis');
  if (filter === 'unpaid') return entries.filter(e => e.paymentStatus !== 'Paid');
  return entries;
}

function updateKPIs(s, all) {
  document.getElementById('kpiTotal').textContent    = s.totalL.toFixed(1) + ' L';
  document.getElementById('kpiEntries').textContent  = all.length + ' entries';
  document.getElementById('kpiMerez').textContent    = s.merezL.toFixed(1) + ' L';
  document.getElementById('kpiRubis').textContent    = s.rubisL.toFixed(1) + ' L';
  document.getElementById('kpiCost').textContent     = 'RWF ' + Math.round(s.totalCost).toLocaleString();
  document.getElementById('kpiAvgPrice').textContent =
    s.avgPrice > 0 ? 'avg RWF ' + Math.round(s.avgPrice).toLocaleString() + '/L' : 'avg — /L';
}

function updateChart(entries) {
  const days   = Store.dailyTotals(entries, 10);
  const labels = days.map(d => d.label);
  const kData  = days.map(d => d.merez);
  const mData  = days.map(d => d.rubis);

  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('fuelChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Merez', data: kData, backgroundColor: '#2563EB', borderRadius: 3, borderSkipped: false, maxBarThickness: 14 },
        { label: 'Rubis', data: mData, backgroundColor: '#16A34A', borderRadius: 3, borderSkipped: false, maxBarThickness: 14 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' } },
        y: { stacked: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF', maxTicksLimit: 4, callback: v => v + 'L' } },
      },
    },
  });
}

function updateBreakdown(s, all) {
  const total = s.merezL + s.rubisL;
  const kPct  = total > 0 ? Math.round((s.merezL / total) * 100) : 0;
  const mPct  = total > 0 ? Math.round((s.rubisL / total) * 100) : 0;

  document.getElementById('barMerez').style.width = kPct + '%';
  document.getElementById('barRubis').style.width = mPct + '%';
  document.getElementById('pctMerez').textContent = kPct + '%';
  document.getElementById('pctRubis').textContent = mPct + '%';
  document.getElementById('unpaidCount').textContent = s.unpaid;
  document.getElementById('busCount').textContent    = s.buses;

  // Unique agents
  const agents = new Set(all.map(e => e.userId).filter(Boolean));
  document.getElementById('agentCount').textContent = agents.size;
}

function renderAgentSummaries(all) {
  const container = document.getElementById('agentSummaryGrid');

  // Group by agent
  const agentMap = {};
  all.forEach(e => {
    const id = e.userId || 'unknown';
    if (!agentMap[id]) {
      agentMap[id] = { name: e.agentName || 'Unknown Agent', email: e.agentEmail || '', entries: [] };
    }
    agentMap[id].entries.push(e);
  });

  const ids = Object.keys(agentMap);
  if (!ids.length) {
    container.innerHTML = '<p style="color:#9CA3AF;font-size:13px;">No agent submissions yet.</p>';
    return;
  }

  container.innerHTML = ids.map(id => {
    const ag     = agentMap[id];
    const litres = ag.entries.reduce((s, e) => s + (e.litres || 0), 0);
    const cost   = ag.entries.reduce((s, e) => s + (e.cost || 0), 0);
    const unpaid = ag.entries.filter(e => e.paymentStatus !== 'Paid').length;
    return `
      <div class="agent-card">
        <div class="agent-card-name">${ag.name}</div>
        <div class="agent-card-email">${ag.email}</div>
        <div class="agent-card-stat"><span>Entries</span><strong>${ag.entries.length}</strong></div>
        <div class="agent-card-stat"><span>Litres</span><strong>${litres.toFixed(1)} L</strong></div>
        <div class="agent-card-stat"><span>Total cost</span><strong>RWF ${Math.round(cost).toLocaleString()}</strong></div>
        <div class="agent-card-stat"><span>Unpaid</span><strong style="color:${unpaid > 0 ? '#DC2626' : '#111827'}">${unpaid}</strong></div>
      </div>`;
  }).join('');
}

function renderTable(entries) {
  const tbody = document.getElementById('logBody');

  // Title + summary line for whatever period is on screen
  const litres = entries.reduce((s, e) => s + (e.litres || 0), 0);
  const cost   = entries.reduce((s, e) => s + (e.cost || 0), 0);
  document.getElementById('logTitle').textContent =
    viewMode === 'month' ? 'Fuel log — ' + niceMonth(selectedMonth) : 'Fuel log — ' + niceDate(selectedDate);
  document.getElementById('logMeta').textContent =
    entries.length + (entries.length === 1 ? ' entry' : ' entries') +
    ' · ' + litres.toFixed(1) + ' L · RWF ' + Math.round(cost).toLocaleString();

  if (!entries.length) {
    const hint = viewMode === 'day'
      ? ` <button class="link-btn" onclick="setViewMode('month')">View entire month</button>`
      : '';
    tbody.innerHTML = `<tr class="empty-row"><td colspan="12">No entries for this ${viewMode === 'day' ? 'day' : 'month'} / filter.${hint}</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const dt         = new Date(e.entryTime);
    const dateStr    = dt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr    = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusClass = { 'Paid':'status-paid','Pending':'status-pending','Credit':'status-credit' }[e.paymentStatus] || 'status-pending';
    return `
      <tr>
        <td style="color:#374151;white-space:nowrap">${dateStr}</td>
        <td style="color:#6B7280;white-space:nowrap">${timeStr}</td>
        <td style="font-size:12px;color:#374151">${e.agentName ? escapeAttr(e.agentName) : '—'}</td>
        <td>
          <span class="station-badge ${e.station === 'merez' ? 'badge-merez' : 'badge-rubis'}">
            ${e.station === 'merez' ? 'Merez' : 'Rubis'}
          </span>
        </td>
        <td><strong>${escapeAttr(e.busPlate)}</strong></td>
        <td>${escapeAttr(e.driverName)}</td>
        <td><strong>${e.litres.toFixed(1)} L</strong></td>
        <td style="color:#6B7280">${e.pricePerLitre ? e.pricePerLitre.toLocaleString() : '—'}</td>
        <td><strong>${e.cost ? e.cost.toLocaleString() : '—'}</strong></td>
        <td><span class="status-badge ${statusClass}">${e.paymentStatus}</span></td>
        <td style="font-size:12px;color:#B45309;max-width:180px;">${e.reason ? escapeAttr(e.reason) : '—'}</td>
        <td>
          <button class="delete-btn" onclick="deleteEntry('${e.id}')" title="Delete entry">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  await Store.remove(id);
  render();
}

function setFilter(f) {
  activeFilter = f;
  ['all','merez','rubis','unpaid'].forEach(id => {
    document.getElementById('f-' + id).classList.toggle('active', id === f);
  });
  render();
}

function updateTimestamp() {
  const now = new Date();
  document.getElementById('lastUpdated').textContent =
    'All agents · All stations · Last updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function exportCSV() {
  const entries = await Store.getAll();
  if (!entries.length) { alert('No data to export yet.'); return; }

  const headers = ['Date/Time','Agent','Station','Plate','Driver','Litres','Price/L (RWF)','Total (RWF)','Status','Odometer','Notes'];
  const rows = entries.map(e => [
    new Date(e.entryTime).toLocaleString(),
    e.agentName || '',
    e.station === 'merez' ? 'Merez' : 'Rubis',
    e.busPlate,
    e.driverName,
    e.litres.toFixed(1),
    e.pricePerLitre || '',
    e.cost || '',
    e.paymentStatus,
    e.odometer || '',
    e.notes || '',
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `excel-travel-fuel-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Monthly reports ----------

function entriesForMonth(all, monthKey) {
  return all
    .filter(e => entryDateKey(e).slice(0, 7) === monthKey)
    .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime)); // oldest -> newest
}

function setReportMonth(v) {
  if (!v) return;
  reportMonth = v;
  updateReportPreview();
}

function updateReportPreview() {
  const list   = entriesForMonth(lastAll, reportMonth);
  const litres = list.reduce((s, e) => s + (e.litres || 0), 0);
  const cost   = list.reduce((s, e) => s + (e.cost || 0), 0);
  const unpaid = list.filter(e => e.paymentStatus !== 'Paid').length;
  const el = document.getElementById('reportPreview');
  const btn = document.getElementById('reportBtn');
  btn.disabled = !list.length;
  btn.style.opacity = list.length ? '1' : '0.5';
  el.innerHTML = list.length
    ? `<strong>${niceMonth(reportMonth)}</strong>: ${list.length} entries · <strong>${litres.toFixed(1)} L</strong> · RWF <strong>${Math.round(cost).toLocaleString()}</strong> · ${unpaid} unpaid/credit`
    : `No entries for ${niceMonth(reportMonth)}.`;
}

async function downloadMonthlyReport() {
  const all  = await Store.getAll();
  const list = entriesForMonth(all, reportMonth);
  if (!list.length) { alert('No entries for ' + niceMonth(reportMonth) + '.'); return; }

  const headers = ['Date','Time','Agent','Station','Plate','Driver','Odometer','Litres','Price/L (RWF)','Total (RWF)','Status','Reason','Notes'];
  const rows = list.map(e => {
    const dt = new Date(e.entryTime);
    return [
      dt.toLocaleDateString('en-GB'),
      dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      e.agentName || '',
      e.station === 'merez' ? 'Merez' : 'Rubis',
      e.busPlate,
      e.driverName,
      e.odometer ?? '',
      e.litres.toFixed(1),
      e.pricePerLitre || '',
      e.cost || '',
      e.paymentStatus,
      e.reason || '',
      e.notes || '',
    ];
  });

  // Totals row + per-station subtotals at the bottom
  const sum = (arr, k) => arr.reduce((s, e) => s + (e[k] || 0), 0);
  const merez = list.filter(e => e.station === 'merez');
  const rubis = list.filter(e => e.station === 'rubis');
  const blank = Array(headers.length).fill('');
  const totalRow = (label, arr) => {
    const r = blank.slice();
    r[0] = label; r[7] = sum(arr, 'litres').toFixed(1); r[9] = Math.round(sum(arr, 'cost'));
    return r;
  };
  rows.push(blank, totalRow('MEREZ TOTAL', merez), totalRow('RUBIS TOTAL', rubis), totalRow('MONTH TOTAL', list));

  const csv = '\uFEFF' + [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `excel-travel-fuel-report-${reportMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}