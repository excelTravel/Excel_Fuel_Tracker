/**
 * agent.js — handles the agent fuel entry form (index.html)
 */

// Auth guard — must be logged in as agent (not admin)
const _session = Auth.requireLogin('login.html');
if (_session && _session.role === 'admin') {
  window.location.href = 'pages/admin-dashboard.html';
}

// Show agent name in nav
document.addEventListener('DOMContentLoaded', () => {
  if (_session) {
    document.getElementById('navUser').textContent = _session.name;
  }
  renderMyLog();
});

let currentStation = 'merez';

// Set datetime input to now
(function initTime() {
  const input = document.getElementById('entryTime');
  if (!input) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  input.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
})();

function setStation(s) {
  currentStation = s;
  const btnK = document.getElementById('btnKigali');
  const btnM = document.getElementById('btnMusanze');
  btnK.className = 'station-btn kigali' + (s === 'merez' ? ' active' : '');
  btnM.className = 'station-btn musanze' + (s === 'rubis' ? ' active' : '');
}

function calcTotal() {
  const litres = parseFloat(document.getElementById('litres').value) || 0;
  const price  = parseFloat(document.getElementById('pricePerLitre').value) || 0;
  const total  = litres * price;
  document.getElementById('totalValue').textContent =
    'RWF ' + (total > 0 ? Math.round(total).toLocaleString() : '0');
}

async function submitEntry(e) {
  e.preventDefault();
  const busPlate      = document.getElementById('busPlate').value.trim().toUpperCase();
  const driverName    = document.getElementById('driverName').value.trim();
  const odometer      = document.getElementById('odometer') ? document.getElementById('odometer').value : '';
  const litres        = parseFloat(document.getElementById('litres').value);
  const pricePerLitre = parseFloat(document.getElementById('pricePerLitre').value);
  const paymentStatus = document.getElementById('paymentStatus').value;
  const entryTime     = document.getElementById('entryTime').value;
  const notes         = document.getElementById('notes').value.trim();

  const entry = {
    station: currentStation,
    busPlate,
    driverName,
    odometer: odometer ? parseInt(odometer, 10) : null,
    litres,
    pricePerLitre,
    paymentStatus,
    entryTime,
    notes,
  };
  // userId / agentName / agentEmail / cost / id are now assigned server-side
  // from the authenticated session — no need to set them here.

  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;

  const saved = await Store.add(entry);

  submitBtn.disabled = false;

  if (!saved) {
    alert('Could not save this entry. Please check your connection and try again.');
    return;
  }

  // Reset form
  ['busPlate','driverName','odometer','litres','pricePerLitre','notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('paymentStatus').value = '';
  document.getElementById('totalValue').textContent = 'RWF 0';

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('entryTime').value =
    `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const banner = document.getElementById('successBanner');
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 4000);

  renderMyLog();
}

/** Render this agent's own entries */
async function renderMyLog() {
  if (!_session) return;
  const tbody   = document.getElementById('myLogBody');
  const counter = document.getElementById('myEntryCount');

  const entries = await Store.getByAgent(_session.id);

  counter.textContent = entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies');

  if (!entries.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No entries yet today.</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const dt      = new Date(e.entryTime);
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusClass = { 'Paid':'status-paid','Pending':'status-pending','Credit':'status-credit' }[e.paymentStatus] || 'status-pending';
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
        <td><strong>${e.cost ? e.cost.toLocaleString() : '—'}</strong></td>
        <td><span class="status-badge ${statusClass}">${e.paymentStatus}</span></td>
      </tr>`;
  }).join('');
}