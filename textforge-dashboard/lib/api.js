/**
 * TextForge Dashboard – API client utilities
 *
 * Centralizes all fetch logic for dashboard pages/components so that
 * individual pages stay thin and API calls are easy to maintain.
 *
 * Every helper accepts an optional `baseUrl` that defaults to the
 * NEXT_PUBLIC_API_URL env variable (empty string = same origin).
 * Mutations (key generation, revocation) that would previously embed
 * credentials in client-side code are now also exposed here, making it
 * straightforward to migrate them to Next.js Server Actions in the future.
 */

const DEFAULT_BASE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around `fetch` that always resolves to parsed JSON.
 * Throws on network errors; non-2xx responses are returned as-is so callers
 * can inspect the `success` / `error` fields from the API.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  return response.json();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Fetch global API statistics (request counts, top actions, uptime …).
 *
 * @param {string} [baseUrl]
 * @returns {Promise<{ success: boolean, stats?: object, error?: string }>}
 */
export async function fetchStats(baseUrl = DEFAULT_BASE_URL) {
  return apiFetch(`${baseUrl}/stats`);
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

/**
 * Retrieve all API keys visible to the current session.
 *
 * @param {string} [baseUrl]
 * @param {string} [customerId]  — Stripe customer ID for Pro customers
 * @returns {Promise<{ success: boolean, keys?: object[], error?: string }>}
 */
export async function fetchKeys(baseUrl = DEFAULT_BASE_URL, customerId = null) {
  const url = customerId ? `${baseUrl}/api/keys?customerId=${encodeURIComponent(customerId)}` : `${baseUrl}/api/keys`;
  return apiFetch(url);
}

/**
 * Generate a new API key.
 *
 * @param {string} [baseUrl]
 * @param {string} [customerId]  — Stripe customer ID for Pro customers
 * @returns {Promise<{ success: boolean, key?: object, error?: string }>}
 */
export async function generateKey(baseUrl = DEFAULT_BASE_URL, customerId = null) {
  const headers = {};
  const body = {};
  if (customerId) {
    headers['X-Customer-Id'] = customerId;
    body.customerId = customerId;
  }
  return apiFetch(`${baseUrl}/api/keys`, { method: 'POST', headers, body: JSON.stringify(body) });
}

/**
 * Revoke (delete) an API key by its database ID.
 *
 * @param {number|string} keyId
 * @param {string} [baseUrl]
 * @param {string} [customerId]  — Stripe customer ID for Pro customers
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function revokeKey(keyId, baseUrl = DEFAULT_BASE_URL, customerId = null) {
  const headers = {};
  if (customerId) headers['X-Customer-Id'] = customerId;
  return apiFetch(`${baseUrl}/api/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE', headers });
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

/**
 * Fetch invoices for a given Stripe customer ID.
 *
 * @param {string} customerId  – Stripe customer ID (e.g. "cus_…")
 * @param {string} [baseUrl]
 * @returns {Promise<{ invoices?: object[], error?: string }>}
 */
export async function fetchInvoices(customerId, baseUrl = DEFAULT_BASE_URL) {
  return apiFetch(
    `${baseUrl}/api/billing/invoices?customerId=${encodeURIComponent(customerId)}`
  );
}

/**
 * Create a Stripe Checkout session for upgrading to Pro.
 *
 * NOTE: The `email` and `customerId` values are user-facing inputs and do
 * not constitute server-side secrets.  Any actual secret keys (Stripe secret
 * key, webhook signing secret) must remain server-side only and must never
 * be passed through this function.
 *
 * @param {{ email: string, customerId?: string|null }} params
 * @param {string} [baseUrl]
 * @returns {Promise<{ sessionId?: string, customerId?: string, ephemeralKey?: string, error?: string }>}
 */
export async function createCheckoutSession({ email, customerId }, baseUrl = DEFAULT_BASE_URL) {
  return apiFetch(`${baseUrl}/api/create-checkout-session`, {
    method: 'POST',
    body: JSON.stringify({ email, customerId })
  });
}
