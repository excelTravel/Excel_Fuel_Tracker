/**
 * store.js — shared data layer for Excel Travel & Tours Fuel Tracker
 * Talks to the backend API. Entries are scoped per agent server-side:
 * admin's getAll() returns everything, an agent's getAll() returns only
 * their own (the server enforces this regardless of who calls it).
 *
 * NOTE: every method is now async (returns a Promise) since it talks to
 * the network. Callers need `await` or `.then()`.
 */

const Store = (() => {

  async function apiRequest(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res, data;
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      data = await res.json().catch(() => ({}));
    } catch {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (!res.ok && data.ok === undefined) {
      return { ok: false, error: data.error || `Request failed (${res.status}).` };
    }
    return data;
  }

  /** Return entries — admin gets all, agents get only their own (server-enforced). */
  async function getAll() {
    const result = await apiRequest('/entries');
    return result.ok ? result.entries : [];
  }

  /** Return entries for a specific agent. With a real backend this is the
   *  same as getAll() when called by that agent, since the server already
   *  scopes results to the logged-in user. Kept for compatibility with
   *  existing callers. */
  async function getByAgent(userId) {
    const all = await getAll();
    return all.filter(e => e.userId === userId);
  }

  /** Add a new entry. Returns the created entry, or null on failure. */
  async function add(entry) {
    const result = await apiRequest('/entries', { method: 'POST', body: entry });
    if (!result.ok) {
      console.error('Failed to save entry:', result.error);
      return null;
    }
    return result.entry;
  }

  /** Remove entry by id. Returns true on success. */
  async function remove(id) {
    const result = await apiRequest('/entries/' + encodeURIComponent(id), { method: 'DELETE' });
    return !!result.ok;
  }

  /** Summary stats from a given entry set (pure function — no network call) */
  function stats(entries) {
    const merez     = entries.filter(e => e.station === 'merez');
    const rubis     = entries.filter(e => e.station === 'rubis');
    const totalL    = entries.reduce((s, e) => s + (e.litres || 0), 0);
    const merezL    = merez.reduce((s, e) => s + (e.litres || 0), 0);
    const rubisL    = rubis.reduce((s, e) => s + (e.litres || 0), 0);
    const totalCost = entries.reduce((s, e) => s + (e.cost || 0), 0);
    const avgPrice  = totalL > 0
      ? entries.reduce((s, e) => s + (e.pricePerLitre || 0), 0) / entries.length : 0;
    const unpaid = entries.filter(e => e.paymentStatus !== 'Paid').length;
    const buses  = new Set(entries.map(e => e.busPlate)).size;
    return { totalL, merezL, rubisL, totalCost, avgPrice, unpaid, buses,
             kigaliL: merezL, musanzeL: rubisL, // aliases for dashboard.js compat
             merezCount: merez.length, rubisCount: rubis.length };
  }

  /**
   * Litres dispensed per calendar day, split by station (pure function).
   * Returns the last `days` days (oldest -> newest), zero-filled.
   */
  function dailyTotals(entries, days = 14) {
    const byDay = {};
    entries.forEach(e => {
      if (!e.entryTime) return;
      const key = String(e.entryTime).slice(0, 10); // YYYY-MM-DD
      if (!byDay[key]) byDay[key] = { merez: 0, rubis: 0 };
      byDay[key][e.station === 'merez' ? 'merez' : 'rubis'] += (e.litres || 0);
    });

    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = byDay[key] || { merez: 0, rubis: 0 };
      out.push({
        date: key,
        label: d.toLocaleDateString([], { day: 'numeric', month: 'short' }),
        merez: day.merez,
        rubis: day.rubis,
        total: day.merez + day.rubis,
      });
    }
    return out;
  }

  return { getAll, getByAgent, add, remove, stats, dailyTotals };

})();

/**
 * Fleet — master list of company buses (admin only), via the backend API.
 * Used to cross-reference which buses received fuel vs. which didn't.
 */
const Fleet = (() => {

  async function apiRequest(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res, data;
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      data = await res.json().catch(() => ({}));
    } catch {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (!res.ok && data.ok === undefined) {
      return { ok: false, error: data.error || `Request failed (${res.status}).` };
    }
    return data;
  }

  /** Return all buses */
  async function getAll() {
    const result = await apiRequest('/fleet');
    return result.ok ? result.buses : [];
  }

  /** Add a bus. Returns { ok, error, bus } */
  async function add(bus) {
    return apiRequest('/fleet', { method: 'POST', body: bus });
  }

  /** Remove a bus by id. Returns true on success. */
  async function remove(id) {
    const result = await apiRequest('/fleet/' + encodeURIComponent(id), { method: 'DELETE' });
    return !!result.ok;
  }

  return { getAll, add, remove };

})();