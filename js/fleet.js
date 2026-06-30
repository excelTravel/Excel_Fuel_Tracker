/**
 * fleet.js — powers the Fleet page (pages/fleet.html)
 * Cross-references the master bus list (Fleet) against the fuel log (Store)
 * to show which buses have/haven't been fuelled in the selected period.
 */

// Auth guard — admin only
const _fleetSession = Auth.requireAdmin('../login.html');

let activePeriod = 'today'; // 'today' | 'week' | 'all'

document.addEventListener('DOMContentLoaded', render);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfToday();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // week starts Monday
  d.setDate(d.getDate() - diff);
  return d;
}

async function entriesForPeriod(period) {
  const all = await Store.getAll();
  if (period === 'all') return all;
  const start = period === 'week' ? startOfWeek() : startOfToday();
  return all.filter(e => e.entryTime && new Date(e.entryTime) >= start);
}

async function render() {
  const [buses, entries] = await Promise.all([
    Fleet.getAll(),
    entriesForPeriod(activePeriod),
  ]);

  // Group fuel entries by plate for quick lookup
  const byPlate = {};
  entries.forEach(e => {
    const plate = (e.busPlate || '').trim().toUpperCase();
    if (!plate) return;
    if (!byPlate[plate]) byPlate[plate] = [];
    byPlate[plate].push(e);
  });

  renderSummary(buses, byPlate);
  renderTable(buses, byPlate);
  updatePeriodLabel();
}

function renderSummary(buses, byPlate) {
  const total    = buses.length;
  const fuelled  = buses.filter(b => byPlate[b.plate] && byPlate[b.plate].length).length;
  document.getElementById('statTotal').textContent      = total;
  document.getElementById('statFuelled').textContent    = fuelled;
  document.getElementById('statNotFuelled').textContent = total - fuelled;
}

function renderTable(buses, byPlate) {
  const tbody = document.getElementById('fleetBody');
  if (!buses.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No buses added yet — add your fleet on the left.</td></tr>`;
    return;
  }

  // Buses without fuel first, so gaps are easy to spot
  const sorted = [...buses].sort((a, b) => {
    const aFuelled = byPlate[a.plate] ? 1 : 0;
    const bFuelled = byPlate[b.plate] ? 1 : 0;
    return aFuelled - bFuelled;
  });

  tbody.innerHTML = sorted.map(b => {
    const busEntries = byPlate[b.plate] || [];
    const fuelled    = busEntries.length > 0;
    const litres     = busEntries.reduce((s, e) => s + (e.litres || 0), 0);

    let lastFuelled = '—';
    if (fuelled) {
      const latest = busEntries.reduce((latestSoFar, e) =>
        new Date(e.entryTime) > new Date(latestSoFar.entryTime) ? e : latestSoFar);
      lastFuelled = new Date(latest.entryTime).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    }

    return `
      <tr>
        <td><strong>${b.plate}</strong></td>
        <td>${b.driverName || '—'}</td>
        <td style="color:#6B7280">${b.model || '—'}</td>
        <td style="color:#6B7280">${b.route || '—'}</td>
        <td>
          <span class="fuel-status-badge ${fuelled ? 'fuel-status-yes' : 'fuel-status-no'}">
            ${fuelled
              ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Fuelled'
              : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Not fuelled'}
          </span>
        </td>
        <td style="color:#6B7280">${lastFuelled}</td>
        <td><strong>${fuelled ? litres.toFixed(1) + ' L' : '—'}</strong></td>
        <td>
          <button class="delete-btn" onclick="removeBus('${b.id}')" title="Remove from fleet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function updatePeriodLabel() {
  const labels = { today: "Showing today's fuel activity", week: 'Showing this week\u2019s fuel activity', all: 'Showing all-time fuel activity' };
  document.getElementById('periodLabel').textContent = labels[activePeriod];
}

function setPeriod(p) {
  activePeriod = p;
  ['today', 'week', 'all'].forEach(id => {
    document.getElementById('p-' + id).classList.toggle('active', id === p);
  });
  render();
}

async function addBus() {
  const errorBox = document.getElementById('fleetError');
  errorBox.style.display = 'none';

  const plate      = document.getElementById('fleetPlate').value;
  const driverName = document.getElementById('fleetDriver').value;
  const model       = document.getElementById('fleetModel').value;
  const route       = document.getElementById('fleetRoute').value;

  const result = await Fleet.add({ plate, driverName, model, route });
  if (!result.ok) {
    errorBox.textContent = result.error;
    errorBox.style.display = 'block';
    return;
  }

  ['fleetPlate', 'fleetDriver', 'fleetModel', 'fleetRoute'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fleetPlate').focus();
  render();
}

async function removeBus(id) {
  if (!confirm('Remove this bus from the fleet list? This cannot be undone.')) return;
  await Fleet.remove(id);
  render();
}