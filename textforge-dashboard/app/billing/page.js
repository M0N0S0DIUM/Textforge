'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CreditCard, FileText, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { billing, getToken } from '../../lib/api';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for testing and small projects',
    features: ['1,000 requests/day', 'All 23 transformations', 'Chained transformations', 'Community support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For production applications',
    features: ['50,000 requests/day', 'All 23 transformations', 'Priority support', 'Webhook delivery', 'Custom presets', 'Usage analytics'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For high-volume and custom needs',
    features: ['Unlimited requests', 'All Pro features', 'Dedicated support', 'SLA guarantee', 'Custom integrations'],
  },
];

export default function Billing() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tier, setTier] = useState('free');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=billing');
      return;
    }
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    if (success) setMessage({ type: 'success', text: 'Payment successful! Your plan has been upgraded.' });
    if (canceled) setMessage({ type: 'info', text: 'Payment canceled. Your plan was not changed.' });

    loadData();
  }, [router, searchParams]);

  async function loadData() {
    setLoading(true);
    try {
      const [subData, invData] = await Promise.all([
        billing.subscription().catch(() => ({ tier: 'free', subscription: null })),
        billing.invoices().catch(() => ({ invoices: [] })),
      ]);
      setTier(subData.tier || 'free');
      setSubscription(subData.subscription);
      setInvoices(invData.invoices || []);
    } catch {
      // silently ignore if not auth'd yet
    } finally {
      setLoading(false);
    }
  }

  const handleUpgrade = async (planId) => {
    if (planId === 'free') return;
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@textforge.co';
      return;
    }
    setCheckoutLoading(planId);
    setMessage(null);
    try {
      const data = await billing.checkout(planId);
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to start checkout.' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const data = await billing.portal();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to open billing portal.' });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription at end of current billing period?')) return;
    setCancelLoading(true);
    try {
      await billing.cancel();
      setMessage({ type: 'success', text: 'Subscription will cancel at end of billing period.' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel subscription.' });
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and invoices</p>
      </div>

      {message && (
        <div className={`mb-6 flex items-start gap-3 p-4 rounded-lg border ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Current Plan */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                tier === 'pro' ? 'bg-green-100 text-green-700' :
                tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
              {subscription?.cancel_at_period_end ? (
                <span className="text-sm text-orange-600">Cancels at period end</span>
              ) : subscription?.current_period_end ? (
                <span className="text-sm text-gray-500">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {tier !== 'free' && (
              <>
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="btn-secondary text-sm py-2 px-3 flex items-center gap-1"
                >
                  {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Manage Billing
                </button>
                {!subscription?.cancel_at_period_end && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="text-sm py-2 px-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1"
                  >
                    {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = tier === plan.id;
          return (
            <div key={plan.id} className={`relative rounded-xl border p-5 flex flex-col ${
              plan.highlighted ? 'border-primary-400 ring-1 ring-primary-400' : 'border-gray-200'
            } ${isCurrent ? 'bg-gray-50' : 'bg-white'}`}>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-xs bg-primary-100 text-primary-700 font-medium px-2 py-0.5 rounded-full">Current</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-60`}
                >
                  {checkoutLoading === plan.id ? 'Redirecting...' : plan.id === 'enterprise' ? 'Contact Sales' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">Invoice History</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 px-3 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {inv.amount_paid != null ? `$${(inv.amount_paid / 100).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {inv.invoice_url ? (
                        <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : '—'}
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
