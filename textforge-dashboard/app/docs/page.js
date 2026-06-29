'use client';

import Link from 'next/link';
import { ArrowLeft, Code2, Zap, Shield, Layers } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">API Documentation</h1>
        
        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
            <p className="text-gray-600 mb-4">
              TextForge provides 28 text transformation utilities through a simple HTTP API. 
              All transformations are stateless and can be called individually or chained together in pipelines.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-mono text-gray-800">
                <strong>Base URL:</strong> https://textforge.co
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
            <p className="text-gray-600 mb-4">
              Free tier (1,000 requests/day) requires no authentication. For higher limits, include your API key in the header:
            </p>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 overflow-x-auto"><code>X-API-Key: your_api_key_here</code></pre>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start Examples</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">cURL</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <pre className="text-green-400 overflow-x-auto"><code>curl "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse"</code></pre>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Python</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <pre className="text-green-400 overflow-x-auto"><code>{`import requests

response = requests.get(
    "https://textforge.co/v1/run",
    params={"input": "Hello World", "operations": "slugify,reverse"}
)
print(response.json())`}</code></pre>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">JavaScript</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <pre className="text-green-400 overflow-x-auto"><code>{`fetch("https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse")
  .then(r => r.json())
  .then(console.log);`}</code></pre>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">PHP</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <pre className="text-green-400 overflow-x-auto"><code>{`<?php
$url = "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse";
$response = file_get_contents($url);
echo $response;
?>`}</code></pre>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Transformations (28)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">slugify</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">camelcase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">snakecase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">kebabcase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">pascalcase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">constantcase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">sentencecase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">titlecase</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">reverse</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">countwords</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">removemultiple</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">removespecial</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">extractemails</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">extracturls</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">extractnumbers</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">truncate</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">leet</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">morse</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">base64encode</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">base64decode</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">hash</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">random</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">palindromecheck</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">htmlencode</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">htmldecode</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">markdownplain</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">unicodenormalize</code>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-gray-900">trimtext</code>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limits</h2>
            <p className="text-gray-600 mb-4">
              Rate limits ensure fair usage and protect our infrastructure from abuse.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
              <h3 className="font-bold text-blue-900 mb-2">Free Tier</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li>1,000 requests per day</li>
                <li>60 requests per minute</li>
                <li>Burst limit: 10 concurrent requests</li>
              </ul>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="font-bold text-purple-900 mb-2">Pro Tier</h3>
              <ul className="list-disc list-inside text-purple-800 space-y-1">
                <li>50,000 requests per day</li>
                <li>1,000 requests per minute</li>
                <li>Burst limit: 50 concurrent requests</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Response Format</h2>
            <p className="text-gray-600 mb-4">All endpoints return JSON responses:</p>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 overflow-x-auto"><code>{`{
  "input": "original text",
  "result": "transformed text",
  "transformations": ["slugify", "reverse"],
  "timestamp": "2026-01-15T10:30:00Z"
}`}</code></pre>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
            <p className="text-gray-600 mb-4">
              Errors return appropriate HTTP status codes with descriptive messages:
            </p>
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <strong className="text-red-900">400 Bad Request:</strong> Invalid input or operations
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <strong className="text-red-900">401 Unauthorized:</strong> Invalid or expired API key
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <strong className="text-red-900">429 Too Many Requests:</strong> Rate limit exceeded
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <strong className="text-red-900">500 Internal Server Error:</strong> Server error
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Support</h2>
            <p className="text-gray-600">
              Need help? Contact us at{' '}
              <a href="mailto:odderonlab@protonmail.com" className="text-primary-600 hover:underline">
                odderonlab@protonmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
