'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Zap, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for testing and small projects',
    features: [
      '1,000 requests/day',
      'All 23 transformations',
      'Chained transformations',
      'Batch processing',
      'Community support',
    ],
    cta: 'Get Started Free',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For production applications',
    features: [
      '50,000 requests/day',
      'All 23 transformations',
      'Chained transformations',
      'Batch processing',
      'Priority support',
      'Webhook delivery',
      'Custom presets',
      'Usage analytics',
    ],
    cta: 'Upgrade to Pro',
    href: '/billing',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For high-volume and custom needs',
    features: [
      'Unlimited requests',
      'All Pro features',
      'Dedicated support',
      'SLA guarantee',
      'Custom integrations',
      'On-premise option',
      'Volume discounts',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@textforge.co',
    highlighted: false,
  },
];

export default function Pricing() {
  const [loading, setLoading] = useState(null);

  const handleClick = async (plan, e) => {
    if (plan.name === 'Pro') {
      e.preventDefault();
      setLoading('Pro');
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
        if (!token) {
          window.location.href = '/signup?next=billing';
          return;
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/billing/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ plan: 'pro' }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else if (data.sessionId && typeof window !== 'undefined') {
          const { loadStripe } = await import('@stripe/stripe-js');
          const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
          await stripe.redirectToCheckout({ sessionId: data.sessionId });
        } else {
          window.location.href = '/billing';
        }
      } catch {
        window.location.href = '/billing';
      } finally {
        setLoading(null);
      }
    }
  };

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start for free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border flex flex-col ${
                plan.highlighted
                  ? 'border-primary-500 shadow-xl ring-2 ring-primary-500'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-semibold">
                    <Zap className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}

              <div className={`p-6 rounded-t-2xl ${plan.highlighted ? 'bg-primary-50' : 'bg-white'}`}>
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
                </div>
                <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.href.startsWith('mailto:') ? (
                    <a
                      href={plan.href}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {plan.cta} <ArrowRight className="ml-1 w-4 h-4" />
                    </a>
                  ) : (
                    <Link
                      href={plan.href}
                      onClick={(e) => handleClick(plan, e)}
                      className={`w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        plan.highlighted
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'border border-primary-600 text-primary-600 hover:bg-primary-50'
                      } ${loading === plan.name ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      {loading === plan.name ? 'Redirecting...' : plan.cta}
                      {loading !== plan.name && <ArrowRight className="ml-1 w-4 h-4" />}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
