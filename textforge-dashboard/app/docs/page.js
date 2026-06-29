'use client';

import { useState } from 'react';
import { Search, Copy, CheckCheck, Terminal, Code2 } from 'lucide-react';
import Navbar from '../../components/navbar';

const transformations = [
  // Formatting
  { name: 'slugify', description: 'Convert to URL-friendly slug', category: 'Formatting', example: '"Hello World" → "hello-world"' },
  { name: 'camelcase', description: 'Convert to camelCase', category: 'Formatting', example: '"hello world" → "helloWorld"' },
  { name: 'snakecase', description: 'Convert to snake_case', category: 'Formatting', example: '"hello world" → "hello_world"' },
  { name: 'kebabcase', description: 'Convert to kebab-case', category: 'Formatting', example: '"hello world" → "hello-world"' },
  { name: 'pascalcase', description: 'Convert to PascalCase', category: 'Formatting', example: '"hello world" → "HelloWorld"' },
  { name: 'constantcase', description: 'Convert to CONSTANT_CASE', category: 'Formatting', example: '"hello world" → "HELLO_WORLD"' },
  
  // Case
  { name: 'uppercase', description: 'Convert to UPPERCASE', category: 'Case', example: '"hello" → "HELLO"' },
  { name: 'lowercase', description: 'Convert to lowercase', category: 'Case', example: '"HELLO" → "hello"' },
  { name: 'titlecase', description: 'Convert to Title Case', category: 'Case', example: '"hello world" → "Hello World"' },
  { name: 'sentencecase', description: 'Convert to Sentence case', category: 'Case', example: '"hello WORLD" → "Hello world"' },
  { name: 'capitalize', description: 'Capitalize first letter', category: 'Case', example: '"hello" → "Hello"' },
  
  // Text Manipulation
  { name: 'reverse', description: 'Reverse the text', category: 'Manipulation', example: '"hello" → "olleh"' },
  { name: 'truncate', description: 'Truncate to length', category: 'Manipulation', example: '"hello world" (5) → "hello..."' },
  { name: 'removemultiple', description: 'Remove consecutive spaces', category: 'Manipulation', example: '"hello  world" → "hello world"' },
  { name: 'removespecial', description: 'Remove special characters', category: 'Manipulation', example: '"hello@world!" → "helloworld"' },
  { name: 'trimtext', description: 'Trim whitespace', category: 'Manipulation', example: '" hello " → "hello"' },
  
  // Analysis
  { name: 'countwords', description: 'Count words', category: 'Analysis', example: '"hello world" → 2' },
  { name: 'countchars', description: 'Count characters', category: 'Analysis', example: '"hello" → 5' },
  { name: 'palindromecheck', description: 'Check if palindrome', category: 'Analysis', example: '"racecar" → true' },
  
  // Extraction
  { name: 'extractemails', description: 'Extract email addresses', category: 'Extraction', example: '"mail@x.com" → ["mail@x.com"]' },
  { name: 'extracturls', description: 'Extract URLs', category: 'Extraction', example: '"https://x.com" → ["https://x.com"]' },
  { name: 'extractnumbers', description: 'Extract numbers', category: 'Extraction', example: '"abc123" → [123]' },
  
  // Encoding
  { name: 'base64encode', description: 'Encode to Base64', category: 'Encoding', example: '"hello" → "aGVsbG8="' },
  { name: 'base64decode', description: 'Decode from Base64', category: 'Encoding', example: '"aGVsbG8=" → "hello"' },
  { name: 'urlencode', description: 'URL encode', category: 'Encoding', example: '"hello world" → "hello%20world"' },
  { name: 'urldecode', description: 'URL decode', category: 'Encoding', example: '"hello%20world" → "hello world"' },
  { name: 'htmlencode', description: 'HTML encode entities', category: 'Encoding', example: '"<" → "&lt;"' },
  
  // Special
  { name: 'leet', description: 'Convert to leetspeak', category: 'Special', example: '"hello" → "h3110"' },
  { name: 'morsecode', description: 'Convert to Morse code', category: 'Special', example: '"SOS" → "...---..."' },
];

const categories = ['All', 'Formatting', 'Case', 'Manipulation', 'Analysis', 'Extraction', 'Encoding', 'Special'];

const endpoints = [
  { method: 'GET', path: '/v1/run', description: 'Chained pipeline transformation' },
  { method: 'POST', path: '/v1/run', description: 'Chained pipeline (JSON body)' },
  { method: 'GET', path: '/transform', description: 'Single transformation' },
  { method: 'POST', path: '/transform', description: 'Single transformation (JSON body)' },
  { method: 'POST', path: '/batch', description: 'Batch processing' },
  { method: 'GET', path: '/health', description: 'Health check' },
  { method: 'GET', path: '/stats', description: 'Usage statistics' },
];

const codeExamples = {
  curl: `curl -X GET "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse"`,
  python: `import requests

response = requests.get(
    "https://textforge.co/v1/run",
    params={"input": "Hello World", "operations": "slugify,reverse"}
)
print(response.json())`,
  javascript: `fetch("https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse")
  .then(r => r.json())
  .then(console.log);`,
  php: `<?php
$url = "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse";
$response = file_get_contents($url);
echo $response;
?>`
};

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('overview');
  const [codeTab, setCodeTab] = useState('curl');
  const [copied, setCopied] = useState(false);

  const filteredTransformations = transformations.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[codeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'endpoints', label: 'Endpoints' },
    { id: 'transformations', label: 'Transformations' },
    { id: 'examples', label: 'Code Examples' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:flex lg:gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 lg:flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="prose max-w-none">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">API Documentation</h1>
                <p className="text-lg text-gray-600 mb-8">
                  TextForge provides 28 transformation utilities through a simple HTTP API.
                </p>

                <div className="bg-gradient-to-br from-blue-50 to-gray-50 rounded-xl p-6 mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Base URL
                  </h2>
                  <code className="block text-lg font-mono text-blue-600">https://textforge.co</code>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start</h2>
                <div className="bg-gray-950 rounded-xl overflow-hidden mb-8">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Code2 className="w-4 h-4" />
                      Quick Start Example
                    </div>
                    <button
                      onClick={handleCopy}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className="p-4 text-sm text-green-400 font-mono overflow-x-auto">
                    <code>{codeExamples.curl}</code>
                  </pre>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
                <p className="text-gray-600 mb-4">
                  Free tier (1,000 requests/day) requires no authentication. For higher limits, include your API key:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-8">
                  <code className="text-sm font-mono text-gray-800">
                    X-API-Key: your_api_key_here
                  </code>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limits</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Free Tier</h3>
                    <p className="text-3xl font-bold text-gray-900">1,000</p>
                    <p className="text-sm text-gray-600">requests/day</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Pro Tier</h3>
                    <p className="text-3xl font-bold text-blue-600">50,000</p>
                    <p className="text-sm text-gray-600">requests/day</p>
                  </div>
                </div>
              </div>
            )}

            {/* Endpoints Tab */}
            {activeTab === 'endpoints' && (
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-8">API Endpoints</h1>
                <div className="space-y-4">
                  {endpoints.map((endpoint, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
                      <div className="flex items-start gap-4">
                        <span className={`px-3 py-1 rounded text-xs font-bold ${
                          endpoint.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {endpoint.method}
                        </span>
                        <div className="flex-1">
                          <code className="text-lg font-mono text-gray-900">{endpoint.path}</code>
                          <p className="text-gray-600 mt-1">{endpoint.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transformations Tab */}
            {activeTab === 'transformations' && (
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">28 Transformations</h1>
                <p className="text-lg text-gray-600 mb-8">Browse all available text transformation operations.</p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search transformations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4">
                  {filteredTransformations.map((transformation, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <code className="text-lg font-mono text-blue-600">{transformation.name}</code>
                          <p className="text-gray-600 mt-2">{transformation.description}</p>
                          <p className="text-sm text-gray-500 mt-2 font-mono">{transformation.example}</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                          {transformation.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredTransformations.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No transformations match your search.
                  </div>
                )}
              </div>
            )}

            {/* Examples Tab */}
            {activeTab === 'examples' && (
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-8">Code Examples</h1>

                <div className="flex gap-2 mb-4">
                  {Object.keys(codeExamples).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setCodeTab(lang)}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                        codeTab === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="bg-gray-950 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
                    <span className="text-sm text-gray-400">{codeTab === 'curl' ? 'cURL' : codeTab}</span>
                    <button
                      onClick={handleCopy}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className="p-6 text-sm text-green-400 font-mono overflow-x-auto">
                    <code>{codeExamples[codeTab]}</code>
                  </pre>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
