'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

const transformations = [
  { name: 'slugify', desc: 'URL-friendly slug', category: 'Formatting', example: 'Hello World!', output: 'hello-world' },
  { name: 'camelcase', desc: 'camelCase', category: 'Case', example: 'user_profile_data', output: 'userProfileData' },
  { name: 'snakecase', desc: 'snake_case', category: 'Case', example: 'userProfileData', output: 'user_profile_data' },
  { name: 'kebabcase', desc: 'kebab-case', category: 'Case', example: 'userProfileData', output: 'user-profile-data' },
  { name: 'pascalcase', desc: 'PascalCase', category: 'Case', example: 'hello world', output: 'HelloWorld' },
  { name: 'constantcase', desc: 'CONSTANT_CASE', category: 'Case', example: 'hello world', output: 'HELLO_WORLD' },
  { name: 'sentencecase', desc: 'Sentence case', category: 'Case', example: 'hello WORLD', output: 'Hello world' },
  { name: 'titlecase', desc: 'Title Case', category: 'Case', example: 'the quick brown fox', output: 'The Quick Brown Fox' },
  { name: 'reverse', desc: 'Reverse string', category: 'Utility', example: 'hello', output: 'olleh' },
  { name: 'countwords', desc: 'Word/char count', category: 'Analysis', example: 'Hello world test', output: '{ words: 3 }' },
  { name: 'removemultiple', desc: 'Remove extra spaces', category: 'Cleanup', example: 'hello   world', output: 'hello world' },
  { name: 'removespecial', desc: 'Remove special chars', category: 'Cleanup', example: 'Hello, World!', output: 'Hello World' },
  { name: 'extractemails', desc: 'Extract emails', category: 'Extraction', example: 'Contact: a@b.com', output: '["a@b.com"]' },
  { name: 'extracturls', desc: 'Extract URLs', category: 'Extraction', example: 'Visit https://example.com', output: '["https://example.com"]' },
  { name: 'extractnumbers', desc: 'Extract numbers', category: 'Extraction', example: 'I have 42 cats', output: '[42]' },
  { name: 'truncate', desc: 'Truncate text', category: 'Utility', example: 'Hello World', output: 'Hello...' },
  { name: 'leet', desc: 'Leet speak', category: 'Encoding', example: 'hello', output: 'h3ll0' },
  { name: 'morse', desc: 'Morse code', category: 'Encoding', example: 'SOS', output: '... --- ...' },
  { name: 'base64encode', desc: 'Base64 encode', category: 'Encoding', example: 'hello', output: 'aGVsbG8=' },
  { name: 'base64decode', desc: 'Base64 decode', category: 'Encoding', example: 'aGVsbG8=', output: 'hello' },
  { name: 'hash', desc: 'SHA-256 hash', category: 'Security', example: 'hello', output: '2cf24dba...' },
  { name: 'random', desc: 'Random string', category: 'Generation', example: 'length=10', output: 'aB3xY9zK2m' },
  { name: 'palindromecheck', desc: 'Check palindrome', category: 'Analysis', example: 'racecar', output: '{ palindrome: true }' }
];

const endpoints = [
  { method: 'GET', path: '/transform', desc: 'Single transformation', auth: false },
  { method: 'POST', path: '/transform', desc: 'Single transformation (JSON)', auth: false },
  { method: 'POST', path: '/batch', desc: 'Batch process texts', auth: false },
  { method: 'GET', path: '/v1/run', desc: 'Chained pipeline', auth: false },
  { method: 'GET', path: '/health', desc: 'Health check', auth: false }
];

export default function Docs() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransformations = useMemo(() => {
    if (!searchQuery) return transformations;
    const q = searchQuery.toLowerCase();
    return transformations.filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.desc.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const groupedTransformations = useMemo(() => {
    const groups = {};
    filteredTransformations.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTransformations]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <aside className="w-full lg:w-64 bg-white border-r border-gray-200 p-4 lg:p-6">
        <Link href="/" className="block py-2 px-3 text-primary-600 font-medium mb-4">← Back to Home</Link>
        <nav className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Getting Started</p>
          <button onClick={() => setActiveTab('overview')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Overview</button>
          <button onClick={() => setActiveTab('auth')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Authentication</button>
          <p className="text-xs font-semibold text-gray-400 uppercase mt-4 mb-2">API Reference</p>
          <button onClick={() => setActiveTab('endpoints')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Endpoints</button>
          <button onClick={() => setActiveTab('transformations')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Transformations</button>
          <button onClick={() => setActiveTab('chaining')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Chaining & Pipelines</button>
          <p className="text-xs font-semibold text-gray-400 uppercase mt-4 mb-2">Advanced</p>
          <button onClick={() => setActiveTab('batch')} className="w-full text-left py-2 px-3 rounded hover:bg-gray-50">Batch Processing</button>
        </nav>
      </aside>
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">API Overview</h1>
            <p className="text-lg text-gray-600 mb-8">TextForge provides 23 text transformation utilities through a single endpoint.</p>
            <div className="code-block mb-6"><code>https://textforge.co</code></div>
          </div>
        )}
        {activeTab === 'auth' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Authentication</h1>
            <p className="text-gray-600 mb-4">Include your API key in the X-API-Key header.</p>
            <div className="code-block mb-4"><code>X-API-Key: tf_pro_0123456789abcdef...</code></div>
          </div>
        )}
        {activeTab === 'endpoints' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Endpoints</h1>
            <div className="space-y-4">
              {endpoints.map((ep, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-sm`}><code>{ep.method}</code></span>
                    <code className="text-gray-900">{ep.path}</code>
                  </div>
                  <p className="text-gray-600 text-sm">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'transformations' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Transformations</h1>
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search transformations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <div className="space-y-6">
              {Object.entries(groupedTransformations).map(([category, transforms]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-gray-700 mb-3">{category}</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {transforms.map((t) => (
                      <div key={t.name} className="card">
                        <code className="text-primary-600 font-semibold">{t.name}</code>
                        <span className="text-sm text-gray-500 ml-2">{t.desc}</span>
                        <div className="text-xs mt-2 text-green-600">→ {t.output}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'chaining' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Chaining & Pipelines</h1>
            <p className="text-gray-600 mb-4">Execute multiple transformations in sequence. Each step feeds into the next.</p>
            <h2 className="text-xl font-semibold mt-6 mb-3">How It Works</h2>
            <p className="text-gray-600 mb-4">The <code className="px-1 bg-gray-100 rounded">/v1/run</code> endpoint accepts an input string and an array of actions. Each action transforms the output of the previous step.</p>
            <h2 className="text-xl font-semibold mt-6 mb-3">Request</h2>
            <div className="code-block mb-4">
              <pre>{`POST /v1/run
Content-Type: application/json
X-API-Key: tf_pro_xxxxx

{
  "input": "Hello World!",
  "pipeline": ["slugify", "reverse", "base64encode"]
}`}</pre>
            </div>
            <h2 className="text-xl font-semibold mt-6 mb-3">Response</h2>
            <div className="code-block mb-4">
              <pre>{`{
  "success": true,
  "input": "Hello World!",
  "pipeline": ["slugify", "reverse", "base64encode"],
  "result": "ZGxyb3ctb2xsZWg=",
  "steps": [
    { "step": 1, "action": "slugify", "result": "hello-world" },
    { "step": 2, "action": "reverse", "result": "dlrow-olleh" },
    { "step": 3, "action": "base64encode", "result": "ZGxyb3ctb2xsZWg=" }
  ],
  "execution_time_ms": 4
}`}</pre>
            </div>
            <h2 className="text-xl font-semibold mt-6 mb-3">Common Pipeline Recipes</h2>
            <div className="space-y-3">
              <div className="card">
                <code className="text-primary-600 font-semibold">URL Slugifier</code>
                <p className="text-sm text-gray-500 mt-1">["removemultiple", "slugify", "kebabcase"]</p>
              </div>
              <div className="card">
                <code className="text-primary-600 font-semibold">Text Cleaner</code>
                <p className="text-sm text-gray-500 mt-1">["removespecial", "removemultiple", "sentencecase"]</p>
              </div>
              <div className="card">
                <code className="text-primary-600 font-semibold">Encode Pipeline</code>
                <p className="text-sm text-gray-500 mt-1">["slugify", "base64encode"]</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold mt-6 mb-3">Webhooks</h2>
            <p className="text-gray-600 mb-4">Add a <code className="px-1 bg-gray-100 rounded">webhook</code> URL to get async delivery of results:</p>
            <div className="code-block mb-4">
              <pre>{`{
  "input": "Hello World",
  "pipeline": ["slugify", "hash"],
  "webhook": "https://your-app.com/webhook"
}`}</pre>
            </div>
          </div>
        )}
        {activeTab === 'batch' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Batch Processing</h1>
            <p className="text-gray-600 mb-4">Process multiple texts in a single request. Perfect for transforming arrays of data.</p>
            <h2 className="text-xl font-semibold mt-6 mb-3">Request</h2>
            <div className="code-block mb-4">
              <pre>{`POST /batch
Content-Type: application/json

{
  "texts": ["Hello World", "Foo Bar", "Test 123"],
  "action": "slugify"
}`}</pre>
            </div>
            <h2 className="text-xl font-semibold mt-6 mb-3">Response</h2>
            <div className="code-block mb-4">
              <pre>{`{
  "success": true,
  "results": ["hello-world", "foo-bar", "test-123"]
}`}</pre>
            </div>
            <h2 className="text-xl font-semibold mt-6 mb-3">Limits</h2>
            <div className="card">
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>Max 100 texts per request</li>
                <li className="flex items-center"><span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>Max 10MB total payload</li>
                <li className="flex items-center"><span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>Same rate limits as single transforms</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
