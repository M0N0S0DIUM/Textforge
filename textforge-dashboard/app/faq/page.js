'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const questions = [
  { q: 'What is TextForge?', a: 'TextForge provides 23 text transformation utilities through a single API endpoint. Transform text with slugify, camelCase, base64, morse code, and more.' },
  { q: 'How do I get an API key?', a: 'Sign in to your dashboard and generate an API key. The free tier includes 1,000 requests/day.' },
  { q: 'What is the rate limit?', a: 'Free tier: 1,000 requests/day. Pro tier: 50,000 requests/day.' },
  { q: 'Can I chain transformations?', a: 'Yes! Use the /v1/run endpoint with multiple actions in a single request.' },
];

export default function FAQ() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">FAQ</h1>
      <div className="space-y-4">
        {questions.map((item, i) => (
          <div key={i} className="card">
            <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
            <p className="text-gray-600 text-sm">{item.a}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/docs" className="text-primary-600 hover:underline">← Back to Docs</Link>
      </div>
    </div>
  );
}
