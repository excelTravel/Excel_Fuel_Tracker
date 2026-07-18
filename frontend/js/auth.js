/**
 * auth.js — authentication layer for Excel Travel & Tours Fuel Tracker
 * Talks to the backend API. The JWT is stored in localStorage (under
 * ET_TOKEN_KEY) so the browser stays logged in across page loads; the
 * actual user data and password handling all live server-side now.
 *
 * NOTE: every method that used to be synchronous is now async (returns a
 * Promise), since it talks to the network. Callers need `await` or `.then()`.
 */

const Auth = (() => {

  const TOKEN_KEY   = 'et_token';
  const SESSION_KEY = 'et_session'; // cached user info, NOT the source of truth

  // ── Token / session helpers ─────────────────────────────────────────────

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  /** Cached user object from the last successful login/me call, or null. */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  // ── Low-level request helper ────────────────────────────────────────────

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }

    let res, data;
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }

    if (!res.ok && data.ok === undefined) {
      return { ok: false, error: data.error || `Request failed (${res.status}).` };
    }
    return data;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Register a new agent. Returns { ok, user, error } */
  async function register({ name, email, password, station }) {
    return request('/auth/register', { method: 'POST', body: { name, email, password, station } });
  }

  /** Login. On success, stores the JWT and cached session. Returns { ok, user, error } */
  async function login(email, password) {
    const result = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (result.ok) {
      setToken(result.token);
      setSession(result.user);
    }
    return result;
  }

  /**
   * Require login — redirect if not logged in.
   * Returns the cached session synchronously (for immediate UI use) and
   * also re-validates the token with the server in the background; if the
   * token is invalid/expired, the user is redirected on the next check.
   */
  function requireLogin(redirectTo = '../login.html') {
    const session = getSession();
    const token   = getToken();
    if (!session || !token) {
      window.location.href = redirectTo;
      return null;
    }
    // Fire-and-forget validation; redirect if the token turned out to be bad.
    request('/auth/me', { auth: true }).then(result => {
      if (!result.ok) {
        clearToken();
        window.location.href = redirectTo;
      } else if (result.user) {
        setSession(result.user); // keep cache current (e.g. newly added fields like station)
      }
    });
    return session;
  }

  /** Re-fetch the current user from the server and refresh the cached
   *  session. Use this before trusting session fields (like `station`)
   *  that might be missing from an older cached session. Returns the
   *  fresh user object, or null if the session is invalid. */
  async function refreshSession() {
    const result = await request('/auth/me', { auth: true });
    if (result.ok && result.user) {
      setSession(result.user);
      return result.user;
    }
    return null;
  }
  function requireAdmin(redirectTo = '../login.html') {
    const session = requireLogin(redirectTo);
    if (session && session.role !== 'admin') {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  }

  /** Logout */
  function logout(redirectTo = '../login.html') {
    clearToken();
    window.location.href = redirectTo;
  }

  /** Generate a password reset token. Returns { ok, token, error } */
  async function generateResetToken(email) {
    return request('/auth/forgot', { method: 'POST', body: { email } });
  }

  /** Reset password using token. Returns { ok, error } */
  async function resetPassword(token, newPassword) {
    return request('/auth/reset', { method: 'POST', body: { token, newPassword } });
  }

  return { register, login, logout, getSession, getToken, requireLogin, requireAdmin,
           generateResetToken, resetPassword, refreshSession };

})();