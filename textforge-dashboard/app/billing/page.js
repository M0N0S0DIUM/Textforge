'use client';

import { useState, useEffect } from 'react';

const API_URL = typeof window !== 'undefined' && window.location.origin
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_API_URL || '');

export default function Billing() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [tier, setTier] = useState('free');
  const [message, setMessage] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('textforge_customer');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setCustomerId(data.customerId);
        setEmail(data.email || '');
      } catch (e) {
        console.error('Failed to parse customer data:', e);
      }
    }
    // Handle success/cancel URL params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'true') {
        setMessage({ type: 'success', text: 'Subscription activated! Your Pro plan is live.' });
        window.history.replaceState({}, '', '/billing');
      } else if (params.get('canceled') === 'true') {
        setMessage({ type: 'info', text: 'Checkout was canceled. You can try again anytime.' });
        window.history.replaceState({}, '', '/billing');
      }
    }
  }, []);

  useEffect(() => {
    if (!customerId) return;
    fetch(`${API_URL}/api/billing/status?customerId=${encodeURIComponent(customerId)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && !data.error) {
          setTier(data.tier || 'free');
          setSubscriptionStatus(data.subscriptionStatus);
          setPeriodEnd(data.currentPeriodEnd);
          setCancelAtPeriodEnd(data.cancelAtPeriodEnd);
        }
      })
      .catch((err) => console.error('Status fetch failed:', err));
  }, [customerId]);

  const handleUpgrade = async () => {
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: 'Enter a valid email to continue.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, customerId, tier: 'pro' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }
      if (data.checkoutUrl) {
        // Save customer BEFORE redirect so it's there on return
        localStorage.setItem('textforge_customer', JSON.stringify({
          customerId: data.customerId,
          email,
        }));
        // Stripe returns the full hosted checkout URL — just redirect there
        window.location.href = data.checkoutUrl;
      } else if (data.sessionId) {
        // Fallback: older response shape — use Stripe JS (not recommended)
        setMessage({ type: 'error', text: 'Checkout URL missing. Please try again.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start checkout.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Network error. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    if (!customerId) return;
    try {
      window.location.href = `${API_URL}/api/billing/portal?customerId=${encodeURIComponent(customerId)}`;
    } catch (e) {
      setMessage({ type: 'error', text: 'Could not open portal.' });
    }
  };

  const isPro = tier === 'pro' && subscriptionStatus === 'active';
  const periodEndFormatted = periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
          Billing &amp; Subscription
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Manage your plan</h1>
        <p className="text-lg text-gray-600">See what you're on, upgrade when you need more bandwidth, or update payment details in one click.</p>
      </header>

      {message && (
        <div role="alert" className={`mb-6 p-4 rounded-xl border ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="font-medium">{message.text}</div>
        </div>
      )}

      {/* Current plan summary */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white mb-8 shadow-xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">Current plan</div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold">{isPro ? 'Pro' : 'Free'}</h2>
              {isPro && cancelAtPeriodEnd && (
                <span className="text-xs px-2 py-1 rounded bg-yellow-600/30 text-yellow-200 font-medium">
                  Cancelling {periodEndFormatted}
                </span>
              )}
              {isPro && !cancelAtPeriodEnd && subscriptionStatus === 'active' && periodEndFormatted && (
                <span className="text-xs px-2 py-1 rounded bg-emerald-600/30 text-emerald-200 font-medium">
                  Renews {periodEndFormatted}
                </span>
              )}
            </div>
            <p className="text-gray-300 mt-1">
              {isPro ? '50,000 requests per day · priority support · full feature set' : '1,000 requests per day · all 28 transformations'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">{isPro ? 'Billed monthly' : 'Monthly cost'}</div>
            <div className="text-3xl font-bold">{isPro ? '$2.99' : '$0'}</div>
          </div>
        </div>

        {customerId ? (
          <button
            onClick={handlePortal}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-4 py-2 border border-white/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open customer portal
          </button>
        ) : (
          <p className="mt-6 text-sm text-gray-400">
            After you upgrade, a customer portal link will appear here for managing payment methods and invoices.
          </p>
        )}
      </section>

      {/* Upgrade section - only shows for free users */}
      {!isPro && (
        <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Upgrade to Pro</h3>
          <p className="text-gray-600 mb-6">Unlock 50,000 requests per day, full webhook delivery, and priority support.</p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="billing-email" className="block text-sm font-medium text-gray-800 mb-2">Billing email</label>
              <input
                id="billing-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">We'll use this for invoices and account notices. Must be real.</p>
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
              >
                {loading ? 'Starting checkout…' : `Upgrade — $2.99/mo`}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Secure payment via Stripe. Cancel anytime.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">What you get</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {ProFeatures.features.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-800">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Security & compliance note */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Payment &amp; security</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>Payments are processed by <strong>Stripe</strong> — your card details never touch our servers.</li>
          <li>All transactions are signed with Stripe webhook secrets to prevent tampering.</li>
          <li>You can cancel from the customer portal at any time. Pro access continues until the end of the current billing period.</li>
          <li>For questions or disputes, email <a className="text-blue-600 hover:underline" href="mailto:odderonlab@protonmail.com">odderonlab@protonmail.com</a>.</li>
        </ul>
      </section>
    </div>
  );
}

// Tiny in-file data object so the feature list is easy to edit without touching JSX.
const ProFeatures = {
  features: [
    '50,000 requests per day',
    'Full webhook delivery',
    'Custom transformation presets',
    'Analytics dashboard with history',
    'Priority email support',
    'Early access to new features',
  ],
};
