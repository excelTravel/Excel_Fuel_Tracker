/**
 * agent.js — handles the agent fuel entry form (index.html)
 */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Auth guard — must be logged in as agent (not admin)
const _session = Auth.requireLogin('login.html');
if (_session && _session.role === 'admin') {
  window.location.href = 'pages/admin-dashboard.html';
}

// Show agent name in nav, and self-heal the station: an older cached
// session may predate the `station` field, so re-fetch from the server
// before trusting it (this is what was silently defaulting everyone to
// Merez when their local session was missing/stale on that field).
document.addEventListener('DOMContentLoaded', async () => {
  const fresh = await Auth.refreshSession();
  if (fresh) {
    currentStation = fresh.station;
    document.getElementById('navUser').textContent = fresh.name;
  }
  if (!currentStation) {
    alert('Your account has no station assigned. Please contact your admin.');
  }
  lockStation();
  populatePlateList();
  renderMyLog();
});

// Agents are permanently tied to the station they registered under —
// the station toggle no longer lets them switch, it just displays it.
let currentStation = _session && _session.station;

// Known bus plates per station, used to populate the plate-number
// suggestions (datalist). Agents can still type a plate that isn't
// on this list — the datalist only suggests, it never restricts input.
const STATION_BUS_PLATES = {
  merez: [
    'RAC126Q','RAB893K','RAB939V','RAB049J','RAB597M','RAC129Q','RAB320D',
    'RAD495Z','RAH114K','RAC127Q','RAE301U','RAC124Q','RAC185X','RAH730H',
    'RAB208L','RAB317D','RAB537V','RAI203B','RAC912J','RAC128Q','RAI209B',
    'RAB704L','RAH118K','RAH573G','RAI255W','RAC306W','RAD547X','RAJ291J',
  ],
  rubis: [
    'RAD546X','RAD549X','RAB239L','RAC765X','RAC306X','RAD545X','RAD047I',
    'RAJ290J','RAB967H','RAC125Q','RAE425J','RAC305X','RAB241H','RAB666M',
    'RAD969Y','RAC414H','RAJ288J','RAJ289J','RAJ287J','RAE587C','RAE586C',
    'RAD548X','RAC180T','RAJ291J','RAI255W','RAB049J',
  ],
};

function populatePlateList() {
  const list = document.getElementById('busPlateList');
  if (!list) return;
  const plates = STATION_BUS_PLATES[currentStation] || [];
  list.innerHTML = plates.map(p => `<option value="${p}"></option>`).join('');
}

// Set datetime input to now
(function initTime() {
  const input = document.getElementById('entryTime');
  if (!input) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  input.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
})();

function lockStation() {
  const btnK = document.getElementById('btnKigali');
  const btnM = document.getElementById('btnMusanze');
  if (!btnK || !btnM) return;
  btnK.className = 'station-btn kigali' + (currentStation === 'merez' ? ' active' : '');
  btnM.className = 'station-btn musanze' + (currentStation === 'rubis' ? ' active' : '');
  // Disable switching — station is fixed to the agent's account.
  btnK.disabled = true;
  btnM.disabled = true;
  btnK.style.opacity = currentStation === 'merez' ? '1' : '0.4';
  btnM.style.opacity = currentStation === 'rubis' ? '1' : '0.4';
  btnK.style.cursor = 'default';
  btnM.style.cursor = 'default';
  btnK.removeAttribute('onclick');
  btnM.removeAttribute('onclick');
}

// Standard fuel price per litre — pre-filled on the form, but agents can
// still overwrite it by hand for the rare entry where the price changed.
const DEFAULT_FUEL_PRICE = 2927;

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
  const reasonField    = document.getElementById('reason');
  const reason          = reasonField ? reasonField.value.trim() : '';

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
    reason,
  };
  // userId / agentName / agentEmail / cost / id are now assigned server-side
  // from the authenticated session — no need to set them here.

  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;

  const result = await Store.add(entry);

  submitBtn.disabled = false;

  if (!result.ok) {
    if (result.duplicate) {
      // Reveal the reason field and stop — don't reset the form, so the
      // agent can just fill in the reason and hit submit again.
      const card = document.getElementById('duplicateReasonCard');
      if (card) {
        card.style.display = '';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (reasonField) reasonField.focus();
      return;
    }
    alert('Could not save this entry. Please check your connection and try again.');
    return;
  }

  // Reset form — price per litre goes back to the standard default rather
  // than blank, since it rarely changes day to day.
  ['busPlate','driverName','odometer','litres','notes','reason'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const duplicateCard = document.getElementById('duplicateReasonCard');
  if (duplicateCard) duplicateCard.style.display = 'none';
  document.getElementById('pricePerLitre').value = DEFAULT_FUEL_PRICE;
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

/** Render this station's log — the server already scopes /entries to the
 *  logged-in agent's own station, so agents never see the other station's
 *  submissions here. */
async function renderMyLog() {
  if (!_session) return;
  const tbody   = document.getElementById('myLogBody');
  const counter = document.getElementById('myEntryCount');

  const entries = await Store.getAll();

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
        <td style="font-size:12px;color:#B45309;max-width:160px;">${e.reason ? escapeHtml(e.reason) : '—'}</td>
      </tr>`;
  }).join('');
}