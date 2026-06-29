'use client';

import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import Navbar from '../../components/navbar';

const faqItems = [
  {
    question: 'What is TextForge?',
    answer: 'TextForge is a text transformation API that provides 28 transformation utilities through a single endpoint. Slugify, camelcase, morse code, and more.'
  },
  {
    question: 'How do I get an API key?',
    answer: 'Sign up for a free account on our dashboard. Free tier includes 1,000 requests/day with no credit card required.'
  },
  {
    question: 'What is the rate limit?',
    answer: 'Free tier: 1,000 requests/day. Pro tier: 50,000 requests/day. Rate limits are per API key.'
  },
  {
    question: 'Can I chain transformations?',
    answer: 'Yes! Use the /v1/run endpoint to chain multiple operations. Results flow through each transformation in sequence.'
  },
  {
    question: 'Do you support webhooks?',
    answer: 'Yes, Pro users can use webhook delivery for async processing. Results are POSTed to your endpoint when complete.'
  },
  {
    question: 'Is there a request size limit?',
    answer: 'Single requests: 1MB. Batch requests: 100 items max, 10MB total. Individual texts: 1MB each.'
  },
  {
    question: 'What happens if I exceed my rate limit?',
    answer: 'You\'ll receive a 429 status code. Implement exponential backoff or upgrade to Pro for higher limits.'
  },
  {
    question: 'Do you offer enterprise plans?',
    answer: 'Yes, for high-volume users. Contact us for custom rate limits, dedicated support, and SLA guarantees.'
  }
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFAQ = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-gray-600">Everything you need to know about TextForge</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFAQ.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-600 border-t border-gray-100">
                  <p className="pt-4 leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFAQ.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No questions match your search.</p>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-16 text-center bg-gradient-to-br from-blue-50 to-gray-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h2>
          <p className="text-gray-600 mb-6">Can't find what you're looking for? Get in touch.</p>
          <a
            href="mailto:support@textforge.co"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
