/**
 * dashboard.js — powers the HQ dashboard (pages/dashboard.html)
 */

// Auth guard — admin only (this page calls Store.getAll(), which requires a token)
const _hqSession = Auth.requireAdmin('../login.html');

let activeFilter = 'all';
let chartInstance = null;

/** On load */
document.addEventListener('DOMContentLoaded', () => {
  render();
  // Auto-refresh every 15 seconds (simulates live polling)
  setInterval(render, 15000);
});

/** Main render function */
async function render() {
  const all      = await Store.getAll();
  const filtered = filterEntries(all, activeFilter);
  const s        = Store.stats(all);

  updateKPIs(s, all.length);
  updateChart(all);
  updateBreakdown(s);
  renderTable(filtered);
  updateTimestamp();
}

/** Filter entries */
function filterEntries(entries, filter) {
  if (filter === 'all')     return entries;
  if (filter === 'merez')  return entries.filter(e => e.station === 'merez');
  if (filter === 'rubis') return entries.filter(e => e.station === 'rubis');
  if (filter === 'unpaid')  return entries.filter(e => e.paymentStatus !== 'Paid');
  return entries;
}

/** KPI cards */
function updateKPIs(s, entryCount) {
  document.getElementById('kpiTotal').textContent   = s.totalL.toFixed(1) + ' L';
  document.getElementById('kpiEntries').textContent = entryCount + ' entries';
  document.getElementById('kpiMerez').textContent  = s.kigaliL.toFixed(1) + ' L';
  document.getElementById('kpiRubis').textContent = s.musanzeL.toFixed(1) + ' L';
  document.getElementById('kpiCost').textContent    = 'RWF ' + Math.round(s.totalCost).toLocaleString();
  document.getElementById('kpiAvgPrice').textContent =
    s.avgPrice > 0 ? 'avg RWF ' + Math.round(s.avgPrice).toLocaleString() + '/L' : 'avg — /L';
}

/** Bar chart */
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

/** Station breakdown bars */
function updateBreakdown(s) {
  const total = s.kigaliL + s.musanzeL;
  const kPct  = total > 0 ? Math.round((s.kigaliL  / total) * 100) : 0;
  const mPct  = total > 0 ? Math.round((s.musanzeL / total) * 100) : 0;

  document.getElementById('barMerez').style.width  = kPct + '%';
  document.getElementById('barRubis').style.width = mPct + '%';
  document.getElementById('pctMerez').textContent  = kPct + '%';
  document.getElementById('pctRubis').textContent = mPct + '%';
  document.getElementById('unpaidCount').textContent = s.unpaid;
  document.getElementById('busCount').textContent    = s.buses;
}

/** Log table */
function renderTable(entries) {
  const tbody = document.getElementById('logBody');
  if (!entries.length) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">No entries for this filter.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const dt      = new Date(e.entryTime);
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusClass = {
      'Paid': 'status-paid',
      'Pending': 'status-pending',
      'Credit': 'status-credit',
    }[e.paymentStatus] || 'status-pending';

    return `
      <tr>
        <td style="color:#6B7280">${timeStr}</td>
        <td>
          <span class="station-badge ${e.station === 'merez' ? 'badge-merez' : 'badge-rubis'}">
            ${e.station === 'merez' ? 'Merez' : 'Rubis'}
          </span>
        </td>
        <td><strong>${e.busPlate}</strong></td>
        <td>${e.driverName}</td>
        <td><strong>${e.litres.toFixed(1)} L</strong></td>
        <td style="color:#6B7280">${e.pricePerLitre ? e.pricePerLitre.toLocaleString() : '—'}</td>
        <td><strong>${e.cost ? e.cost.toLocaleString() : '—'}</strong></td>
        <td><span class="status-badge ${statusClass}">${e.paymentStatus}</span></td>
      </tr>`;
  }).join('');
}

/** Filter buttons */
function setFilter(f) {
  activeFilter = f;
  ['all', 'merez', 'rubis', 'unpaid'].forEach(id => {
    document.getElementById('f-' + id).classList.toggle('active', id === f);
  });
  render();
}

/** Last updated timestamp */
function updateTimestamp() {
  const now = new Date();
  document.getElementById('lastUpdated').textContent =
    'All stations · Last updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Export to CSV */
async function exportCSV() {
  const entries = await Store.getAll();
  if (!entries.length) {
    alert('No data to export yet.');
    return;
  }

  const headers = ['Date/Time', 'Station', 'Plate', 'Driver', 'Litres', 'Price/L (RWF)', 'Total (RWF)', 'Status', 'Odometer', 'Notes'];
  const rows = entries.map(e => [
    new Date(e.entryTime).toLocaleString(),
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
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `excel-travel-fuel-log-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}