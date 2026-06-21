'use client';

import { useState } from 'react';
import { Play, Copy, Check, ChevronDown } from 'lucide-react';

const TRANSFORMATIONS = [
  { value: 'slugify', label: 'slugify – URL-friendly slug' },
  { value: 'camelcase', label: 'camelcase – camelCase' },
  { value: 'snakecase', label: 'snakecase – snake_case' },
  { value: 'kebabcase', label: 'kebabcase – kebab-case' },
  { value: 'pascalcase', label: 'pascalcase – PascalCase' },
  { value: 'constantcase', label: 'constantcase – CONSTANT_CASE' },
  { value: 'sentencecase', label: 'sentencecase – Sentence case' },
  { value: 'titlecase', label: 'titlecase – Title Case' },
  { value: 'reverse', label: 'reverse – Reverse string' },
  { value: 'countwords', label: 'countwords – Word/char count' },
  { value: 'removemultiple', label: 'removemultiple – Remove extra spaces' },
  { value: 'removespecial', label: 'removespecial – Remove special chars' },
  { value: 'extractemails', label: 'extractemails – Extract emails' },
  { value: 'extracturls', label: 'extracturls – Extract URLs' },
  { value: 'extractnumbers', label: 'extractnumbers – Extract numbers' },
  { value: 'truncate', label: 'truncate – Truncate text' },
  { value: 'leet', label: 'leet – Leet speak' },
  { value: 'morse', label: 'morse – Morse code' },
  { value: 'base64encode', label: 'base64encode – Base64 encode' },
  { value: 'base64decode', label: 'base64decode – Base64 decode' },
  { value: 'hash', label: 'hash – SHA-256 hash' },
  { value: 'random', label: 'random – Random string' },
  { value: 'palindromecheck', label: 'palindromecheck – Check palindrome' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function Playground() {
  const [text, setText] = useState('Hello, World!');
  const [action, setAction] = useState('slugify');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedResult, setCopiedResult] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const curlCommand = `curl "${API_URL}/transform?text=${encodeURIComponent(text)}&action=${action}"`;

  const handleRun = async () => {
    if (!text.trim()) {
      setError('Please enter some text to transform.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      const headers = token ? { 'X-API-Key': token } : {};
      const qs = new URLSearchParams({ text, action }).toString();
      const res = await fetch(`${API_URL}/transform?${qs}`, { headers });
      const data = await res.json();
      if (data.success === false) {
        setError(data.error || 'Transformation failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to connect to API. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = () => {
    const val = result?.result !== undefined ? String(result.result) : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(val);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const resultValue = result?.result !== undefined
    ? (typeof result.result === 'object' ? JSON.stringify(result.result, null, 2) : String(result.result))
    : result ? JSON.stringify(result, null, 2) : '';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">API Playground</h1>
        <p className="text-gray-600 mt-2">Test any of the 23 transformations interactively.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">Transformation</label>
            <div className="relative">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {TRANSFORMATIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">Input Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Enter text to transform..."
            />
            <button
              onClick={handleRun}
              disabled={loading}
              className="btn-primary w-full mt-3 justify-center"
            >
              <Play className="w-4 h-4 mr-2" />
              {loading ? 'Running...' : 'Run Transformation'}
            </button>
          </div>
        </div>

        {/* Output panel */}
        <div className="space-y-4">
          <div className="card flex-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Output</label>
              {result && (
                <button onClick={handleCopyResult} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                  {copiedResult ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}

            {!result && !error && (
              <div className="min-h-32 flex items-center justify-center text-gray-400 text-sm">
                Run a transformation to see the output here.
              </div>
            )}

            {result && (
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-auto min-h-32 whitespace-pre-wrap break-all">
                {resultValue}
              </pre>
            )}
          </div>

          {/* cURL example */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">cURL Command</label>
              <button onClick={handleCopyCurl} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                {copiedCurl ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <pre className="code-block text-xs whitespace-pre-wrap break-all">{curlCommand}</pre>
          </div>

          {result?.metadata && (
            <div className="card">
              <p className="text-sm font-medium text-gray-700 mb-2">Metadata</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {result.metadata.cached !== undefined && (
                  <>
                    <dt className="text-gray-500">Cached</dt>
                    <dd className="font-medium">{result.metadata.cached ? 'Yes' : 'No'}</dd>
                  </>
                )}
                {result.metadata.processingTime !== undefined && (
                  <>
                    <dt className="text-gray-500">Processing</dt>
                    <dd className="font-medium">{result.metadata.processingTime}ms</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
