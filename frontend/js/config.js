/**
 * config.js — points the frontend at the Node.js/Express backend.
 *
 * Local development: the backend (see /backend) runs on port 5000 by
 * default, so the fallback below works out of the box with no changes.
 *
 * Deploying: don't edit this file directly for a per-environment URL.
 * Instead, set window.API_BASE_URL in an inline <script> BEFORE this file
 * is loaded, e.g. in each HTML page's <head>:
 *
 *   <script>window.API_BASE_URL = 'https://api.exceltravel.rw/api';</script>
 *   <script src="js/config.js"></script>
 *
 * That keeps one config.js working across local/staging/production without
 * editing source per deploy.
 */
const API_BASE_URL = 'https://excel-fuel-tracker.onrender.com';
