'use client';

import { useState, useEffect } from 'react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for testing and small projects',
    features: ['1,000 requests/day', 'All 23 transformations', 'Chaining support', 'Community support'],
    cta: 'Current Plan',
    current: true,
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For production applications',
    features: ['50,000 requests/day', 'Priority support', 'Webhook delivery', 'Custom presets', 'Analytics'],
    cta: 'Upgrade to Pro',
    current: false,
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [message, setMessage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Load customer data from localStorage
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
  }, []);

  // Fetch invoices when customerId is available
  useEffect(() => {
    if (!customerId) return;
    setInvoicesLoading(true);
    fetch(`${API_URL}/api/billing/invoices?customerId=${encodeURIComponent(customerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.invoices) setInvoices(data.invoices);
      })
      .catch((err) => console.error('Failed to fetch invoices:', err))
      .finally(() => setInvoicesLoading(false));
  }, [customerId]);

  const handleUpgrade = async (plan) => {
    if (plan.name === 'Free') {
      return;
    }

    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, customerId }),
      });

      const data = await response.json();

      if (data.sessionId) {
        // Store customer data
        localStorage.setItem('textforge_customer', JSON.stringify({
          customerId: data.customerId,
          email,
        }));

        // Redirect to Stripe Checkout
        window.location.href = `https://checkout.stripe.com/checkout/session/${data.sessionId}?eph_key=${data.ephemeralKey}`;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create checkout session.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
        <p className="text-xl text-gray-600">Start free, scale as you grow</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => (
          <div key={plan.name} className={`card relative ${plan.current ? 'border-primary-500 ring-2 ring-primary-500' : ''}`}>
            {plan.current && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Current Plan
                </span>
              </div>
            )}
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">{plan.price}</div>
              {plan.price !== 'Custom' && <div className="text-gray-500">/month</div>}
              <p className="text-gray-600 mt-2 text-sm">{plan.description}</p>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade(plan)}
              disabled={plan.current || loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                plan.current
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {loading ? 'Processing...' : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Email Input for Pro Plan */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Email for Billing</h2>
        <p className="text-gray-600 mb-4">Enter your email for receiving invoices and updates.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Payment Methods */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
        {customerId ? (
          <p className="text-gray-500 text-sm">
            Payment method details are managed via the Stripe customer portal. Use the portal link above to update your payment method.
          </p>
        ) : (
          <p className="text-gray-500 text-sm">No payment method on file. Upgrade to Pro to add a payment method.</p>
        )}
      </div>

      {/* Billing History */}
      <div className="mt-8 card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing History</h2>
        {invoicesLoading ? (
          <p className="text-gray-500 text-sm">Loading billing history...</p>
        ) : invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No billing history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{inv.stripe_invoice_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${((inv.amount_paid || 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        inv.status === 'paid'
                          ? 'text-green-700 bg-green-100'
                          : 'text-yellow-700 bg-yellow-100'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple check icon component
function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
