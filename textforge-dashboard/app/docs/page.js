'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Copy, Check } from 'lucide-react';

const transformations = [
  { name: 'slugify', desc: 'URL-friendly slug', example: '"Hello World!"', output: '"hello-world"' },
  { name: 'camelcase', desc: 'camelCase', example: '"user_profile_data"', output: '"userProfileData"' },
  { name: 'snakecase', desc: 'snake_case', example: '"userProfileData"', output: '"user_profile_data"' },
  { name: 'kebabcase', desc: 'kebab-case', example: '"userProfileData"', output: '"user-profile-data"' },
  { name: 'pascalcase', desc: 'PascalCase', example: '"hello world"', output: '"HelloWorld"' },
  { name: 'constantcase', desc: 'CONSTANT_CASE', example: '"hello world"', output: '"HELLO_WORLD"' },
  { name: 'sentencecase', desc: 'Sentence case', example: '"hello WORLD"', output: '"Hello world"' },
  { name: 'titlecase', desc: 'Title Case', example: '"the quick brown fox"', output: '"The Quick Brown Fox"' },
  { name: 'reverse', desc: 'Reverse string', example: '"hello"', output: '"olleh"' },
  { name: 'countwords', desc: 'Word/char count', example: '"Hello world test"', output: '{ words: 3, chars: 17, spaces: 2, sentences: 0 }' },
  { name: 'removemultiple', desc: 'Remove extra spaces', example: '"hello   world"', output: '"hello world"' },
  { name: 'removespecial', desc: 'Remove special chars', example: '"Hello, World! 123"', output: '"Hello World 123"' },
  { name: 'extractemails', desc: 'Extract emails', example: '"Contact: a@b.com"', output: '["a@b.com"]' },
  { name: 'extracturls', desc: 'Extract URLs', example: '"Visit https://example.com"', output: '["https://example.com"]' },
  { name: 'extractnumbers', desc: 'Extract numbers', example: '"I have 42 cats"', output: '[42]' },
  { name: 'truncate', desc: 'Truncate text', example: '"Hello World" + limit=5', output: '"Hello..."' },
  { name: 'leet', desc: 'Leet speak', example: '"hello"', output: '"h3ll0"' },
  { name: 'morse', desc: 'Morse code', example: '"SOS"', output: '"... --- ..."' },
  { name: 'base64encode', desc: 'Base64 encode', example: '"hello"', output: '"aGVsbG8="' },
  { name: 'base64decode', desc: 'Base64 decode', example: '"aGVsbG8="', output: '"hello"' },
  { name: 'hash', desc: 'SHA-256 hash', example: '"hello"', output: '"2cf24dba5..."' },
  { name: 'random', desc: 'Random string', example: 'length=10, type=alnum', output: '"aB3xY9zK2m"' },
  { name: 'palindromecheck', desc: 'Check palindrome', example: '"A man a plan..."', output: '{ palindrome: true }' },
];

const endpoints = [
  { method: 'GET', path: '/transform', desc: 'Single transformation via query params' },
  { method: 'POST', path: '/transform', desc: 'Single transformation via JSON body' },
  { method: 'POST', path: '/batch', desc: 'Batch process multiple texts' },
  { method: 'GET', path: '/health', desc: 'Health check' },
  { method: 'GET', path: '/stats', desc: 'API statistics' },
  { method: 'GET', path: '/api/presets', desc: 'List custom presets (Pro)' },
  { method: 'POST', path: '/api/presets', desc: 'Create custom preset (Pro)' },
  { method: 'GET', path: '/api/presets/:id', desc: 'Get preset details (Pro)' },
  { method: 'PUT', path: '/api/presets/:id', desc: 'Update preset (Pro)' },
  { method: 'DELETE', path: '/api/presets/:id', desc: 'Delete preset (Pro)' },
  { method: 'GET', path: '/api/analytics', desc: 'Get usage analytics (Pro)' },
  { method: 'GET', path: '/api/analytics/usage', desc: 'Get usage summary for dashboard (Pro)' },
];

export default function Docs() {
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const exampleCode = `curl -X GET "https://textforge.co/transform?text=Hello%20World!&action=slugify"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 min-h-screen bg-white border-r border-gray-200 p-6">
        <nav className="space-y-1">
          <Link href="/" className="block py-2 px-3 text-primary-600 font-medium">
            ← Back to Home
          </Link>
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Getting Started</p>
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'overview' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'auth' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Authentication
          </button>
          <button
            onClick={() => setActiveTab('rate-limiting')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'rate-limiting' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Rate Limiting
          </button>
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Reference</p>
          </div>
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'endpoints' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Endpoints
          </button>
          <button
            onClick={() => setActiveTab('transformations')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'transformations' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Transformations
          </button>
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pro Features</p>
          </div>
          <button
            onClick={() => setActiveTab('presets')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'presets' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Custom Presets
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm ${activeTab === 'analytics' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Analytics
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {activeTab === 'overview' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">API Overview</h1>
            <div className="prose max-w-none">
              <p className="text-lg text-gray-600 mb-8">
                TextForge provides <strong>23 text transformation utilities</strong> through a single endpoint. 
                Each transformation is fast (&lt;5ms) and can be chained together for complex operations.
              </p>

              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Base URL</h2>
              <div className="code-block mb-8" style={{ backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '16px', overflow: 'auto' }}>
                <code style={{ color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px' }}>https://textforge.co</code>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Quick Start</h2>
              <div className="code-block mb-8 relative" style={{ backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '16px', overflow: 'auto', position: 'relative' }}>
                <button onClick={handleCopy} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white" style={{ zIndex: 1 }}>
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre style={{ color: '#d4d4d4', margin: 0, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}>{exampleCode}</pre>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Response Format</h2>
              <div className="code-block mb-8" style={{ backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '16px', overflow: 'auto' }}>
                <pre style={{ color: '#d4d4d4', margin: 0, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}>{`{
  "success": true,
  "original": "Hello World!",
  "action": "slugify",
  "result": "hello-world",
  "execution_time_ms": 1.2
}`}</pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Authentication</h1>
            <p className="text-gray-600 mb-8">
              TextForge uses API keys for authentication. Include your key in the <code>X-API-Key</code> header.
            </p>
            <p className="text-gray-600 mb-4">
              Pro keys use the format <code>tf_pro_&lt;32 lowercase hex chars&gt;</code>.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Getting Your Key</h2>
            <p className="text-gray-600 mb-4">
              Sign in to your dashboard to generate an API key.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Usage</h2>
            <div className="code-block mb-8" style={{ backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '16px', overflow: 'auto' }}>
              <pre style={{ color: '#d4d4d4', margin: 0, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}>{`curl -H "X-API-Key: tf_pro_0123456789abcdef0123456789abcdef" \\
  "https://textforge.co/transform?text=Hello&action=slugify"`}</pre>
            </div>
          </div>
        )}

        {activeTab === 'rate-limiting' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Rate Limiting</h1>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Limits</h2>
            <div className="overflow-x-auto mb-8">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Daily Limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4">Free</td>
                    <td className="px-6 py-4">1,000 requests</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4">Pro</td>
                    <td className="px-6 py-4">50,000 requests</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Headers</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999`}</pre>
            </div>
            <p className="text-gray-600 mb-4">
              Redis-backed deployments share rate limits across instances. Without Redis, rate limits fall back to in-memory counters for single-instance use only.
            </p>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Endpoints</h1>
            <div className="space-y-6">
              {endpoints.map((ep, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-sm font-mono font-medium ${
                      ep.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ep.method}
                    </span>
                    <code className="text-gray-900">{ep.path}</code>
                  </div>
                  <p className="text-gray-600 text-sm">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transformations' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Transformations</h1>
            <div className="space-y-4">
              {transformations.map((t) => (
                <div key={t.name} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-primary-600 font-semibold">{t.name}</code>
                    <span className="text-sm text-gray-500">{t.desc}</span>
                  </div>
                  <div className="code-block text-sm">
                    <span className="text-gray-400">Input:</span> <code className="text-gray-300">{t.example}</code>
                    <span className="text-gray-400 ml-4">Output:</span> <code className="text-green-400">{t.output}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Custom Presets (Pro)</h1>
            <p className="text-gray-600 mb-8">
              Save and reuse custom transformation chains. Requires Pro tier API key.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">List Presets</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`GET /api/presets
Authorization: X-API-Key: tf_pro_...`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Create Preset</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`POST /api/presets
Authorization: X-API-Key: tf_pro_...
Content-Type: application/json

{
  "name": "my-url-slug",
  "actions": ["slugify", "removespecial", "kebabcase"],
  "description": "URL-friendly slug preset"
}`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Get Preset</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`GET /api/presets/:id
Authorization: X-API-Key: tf_pro_...`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Update Preset</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`PUT /api/presets/:id
Authorization: X-API-Key: tf_pro_...
Content-Type: application/json

{
  "actions": ["slugify", "kebabcase"],
  "description": "Updated description"
}`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Delete Preset</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`DELETE /api/presets/:id
Authorization: X-API-Key: tf_pro_...`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Use Custom Preset in Transform</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`GET /transform?text=Hello%20World&preset=my-url-slug
Authorization: X-API-Key: tf_pro_...`}</pre>
            </div>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Note</h3>
              <p className="text-blue-800 text-sm">
                Custom presets are scoped to your customer account. You can only access presets you created.
                Preset names must be unique per customer.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-6">Analytics (Pro)</h1>
            <p className="text-gray-600 mb-8">
              Track your API usage, performance, and transformation patterns. Requires Pro tier API key.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Full Analytics</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`GET /api/analytics?period=30d
Authorization: X-API-Key: tf_pro_...

# Query Parameters
# period: 7d, 30d, 90d, or all
# startDate: YYYY-MM-DD (optional, with endDate)
# endDate: YYYY-MM-DD (optional, with startDate)`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Response Format</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`{
  "success": true,
  "analytics": {
    "summary": {
      "totalRequests": 1250,
      "totalTransformations": 3400,
      "avgLatencyMs": 2.1,
      "totalRequestBytes": 1024000,
      "totalResponseBytes": 2048000,
      "totalErrors": 3,
      "errorRate": 0.24,
      "actionBreakdown": {
        "slugify": 500,
        "camelcase": 300,
        "base64encode": 200
      }
    },
    "daily": [
      { "date": "2026-01-15", "total_requests": 42, "total_transformations": 120, ... },
      ...
    ],
    "topActions": [
      { "action": "slugify", "count": 500, "avg_latency_ms": 1.5 },
      ...
    ],
    "recentRequests": [
      { "action": "slugify", "status_code": 200, "latency_ms": 1, "created_at": "..." },
      ...
    ]
  }
}`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Usage Summary (for Dashboard)</h2>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`GET /api/analytics/usage
Authorization: X-API-Key: tf_pro_...

{
  "success": true,
  "usage": {
    "today": { "requests_today": 42, "transforms_today": 120 },
    "thisMonth": { "requests_this_month": 1250, "transforms_this_month": 3400 },
    "lastMonth": { "requests_last_month": 980 },
    "rateLimit": { "limit": 50000, "used": 1250, "remaining": 48750, "resetAt": 1704067200000 }
  }
}`}</pre>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Daily Rollup</h2>
            <p className="text-gray-600 mb-4">
              Analytics are aggregated daily via a rollup job. The <code>/api/analytics</code> endpoint reads from 
              the <code>daily_analytics</code> table which is updated from <code>request_logs</code> each day.
            </p>
            <div className="code-block mb-8">
              <pre className="text-gray-300">{`# Trigger rollup manually (admin)
POST /api/analytics/rollup`}</pre>
            </div>

            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Pro Feature</h3>
              <p className="text-green-800 text-sm">
                Analytics are available only for Pro tier API keys (tf_pro_...). 
                Free tier users will receive a 401 error.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
