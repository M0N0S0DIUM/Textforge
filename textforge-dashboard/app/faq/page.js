'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is TextForge?",
      answer: "TextForge is a cloud-based text transformation API that provides 28 different operations (like slugify, camelCase, base64 encoding, etc.) that you can use individually or chain together in pipelines. It's designed for developers who need to transform text data in their applications."
    },
    {
      question: "How do I use the API?",
      answer: "You can use the /transform endpoint for single operations or /v1/run for chaining multiple operations together. Simply send your text and specify which transformation(s) you want to apply. Check our documentation for detailed examples in cURL, Python, JavaScript, and PHP."
    },
    {
      question: "What transformations are available?",
      answer: "TextForge offers 28 transformations including: slugify, camelcase, snakecase, kebabcase, pascalcase, constantcase, uppercase, lowercase, titlecase, sentencecase, capitalize, reverse, truncate, removespecial, removespaces, trimlines, removeemptylines, extractnumbers, extractemails, extracturls, countwords, countchars, base64encode, base64decode, urlencode, urldecode, htmlencode, and htmldecode."
    },
    {
      question: "Can I chain multiple transformations?",
      answer: "Yes! You can chain multiple transformations together in a pipeline. For example, you could slugify text, then convert it to uppercase, all in a single API call. Just provide a comma-separated list of operations."
    },
    {
      question: "What's the difference between Free and Pro tiers?",
      answer: "Free tier includes 1,000 requests per day with 60 requests per minute limit. Pro tier offers 50,000 requests per day with 1,000 requests per minute, plus higher burst limits and priority support. Pro is $2.99/month."
    },
    {
      question: "Do I need an API key for the free tier?",
      answer: "No, the free tier doesn't require an API key. You can start using the API immediately. However, if you want higher rate limits, you'll need to upgrade to Pro and use your API key."
    },
    {
      question: "How do I get a Pro API key?",
      answer: "Sign in to your account and visit the Billing page. After subscribing, your API key will be automatically generated and displayed. You can also view and manage your keys from the API Keys page."
    },
    {
      question: "What happens if I exceed the rate limit?",
      answer: "If you exceed the rate limit, you'll receive a 429 Too Many Requests response. The response includes a Retry-After header indicating how many seconds to wait before making another request. Consider upgrading to Pro if you consistently hit limits."
    },
    {
      question: "Can I test transformations before using them?",
      answer: "Yes! Visit our Playground page to try out all 28 transformations interactively. You can see real-time results and even run all transformations at once on your text."
    },
    {
      question: "Is there a sandbox or test environment?",
      answer: "The free tier essentially acts as a sandbox - you get 1,000 requests per day without needing to sign up or provide payment information. This is perfect for testing and development."
    },
    {
      question: "What's the maximum text length I can transform?",
      answer: "Text transformations accept up to 10MB of text per request. For larger texts, you should chunk your data into multiple requests."
    },
    {
      question: "Do you support batch processing?",
      answer: "Yes! The /batch endpoint allows you to process multiple texts in a single request. You can send up to 100 items per batch request."
    },
    {
      question: "How do I cancel my Pro subscription?",
      answer: "Visit the Billing page and click 'Manage Subscription'. You'll be taken to the Stripe customer portal where you can cancel your subscription. Your Pro access continues until the end of your current billing period."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer refunds on a case-by-case basis. If you're not satisfied with the service, contact us at odderonlab@protonmail.com within 7 days of your purchase."
    },
    {
      question: "Is my data secure?",
      answer: "Yes. All API communication uses HTTPS encryption. We don't store your text data - transformations are performed in memory and the results are returned immediately. We only log request metadata for rate limiting and analytics."
    },
    {
      question: "Can I self-host TextForge?",
      answer: "TextForge is currently only available as a hosted service. We're considering offering a self-hosted option in the future. Contact us if you're interested."
    },
    {
      question: "What's your uptime guarantee?",
      answer: "We maintain 99.9% uptime. You can check our current status at textforge.co/health. We use Redis for caching and have automatic failover mechanisms in place."
    },
    {
      question: "Do you have SDKs for different languages?",
      answer: "We don't have official SDKs yet, but the API is simple enough that you can use standard HTTP libraries in any language. Check our documentation for examples in cURL, Python, JavaScript, and PHP."
    },
    {
      question: "Can I suggest new transformations?",
      answer: "Absolutely! We're always looking to expand our offerings. Send your suggestions to odderonlab@protonmail.com and we'll consider them for future updates."
    },
    {
      question: "How do I report a bug?",
      answer: "Please email us at odderonlab@protonmail.com with details about the bug, including the transformation you were using, your input, and the unexpected output. Screenshots and request IDs help us debug faster."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h1>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-primary-50 border border-primary-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-primary-900 mb-2">Still have questions?</h2>
          <p className="text-primary-800 mb-4">
            Can't find what you're looking for? We're here to help.
          </p>
          <a
            href="mailto:odderonlab@protonmail.com"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
