const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tf_token');
}

function getHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: getHeaders(options.headers),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const auth = {
  signup: (email, password, name) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// API Keys
export const keys = {
  list: () => request('/api/keys'),
  create: (name) => request('/api/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  revoke: (id) => request(`/api/keys/${id}`, { method: 'DELETE' }),
};

// Billing
export const billing = {
  checkout: (plan) => request('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  portal: () => request('/billing/portal', { method: 'POST' }),
  subscription: () => request('/billing/subscription'),
  invoices: () => request('/billing/invoices'),
  cancel: () => request('/billing/cancel', { method: 'POST' }),
};

// User stats
export const users = {
  stats: () => request('/users/stats'),
  history: (limit = 50, offset = 0) => request(`/users/history?limit=${limit}&offset=${offset}`),
};

// Transform
export const transform = {
  single: (text, action, params = {}) => {
    const qs = new URLSearchParams({ text, action, ...params }).toString();
    return request(`/transform?${qs}`);
  },
};

export { getToken, API_URL };
