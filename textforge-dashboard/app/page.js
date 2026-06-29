'use client';

import Link from 'next/link';
import { useState } from 'react';
import { 
  Layers, Code2, Zap, ArrowRight, Terminal, BookOpen, 
  CheckCircle2, Globe, Shield, Settings2, Database, 
  GitBranch, Clock, Users, Star
} from 'lucide-react';
import Navbar from '../components/navbar';

const transformations = [
  'slugify', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase', 'constantcase',
  'uppercase', 'lowercase', 'titlecase', 'sentencecase', 'reverse', 'capitalize',
  'truncate', 'removemultiple', 'removespecial', 'extractemails', 'extracturls',
  'extractnumbers', 'countwords', 'countchars', 'palindromecheck', 'leet',
  'morsecode', 'base64encode', 'base64decode', 'urlencode', 'urldecode',
  'htmlencode',
];

const codeExample = `curl -X GET "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse"`;

export default function Home() {
  const [activeTab, setActiveTab] = useState('curl');

  const codeSnippets = {
    curl: codeExample,
    python: `import requests

response = requests.get(
    "https://textforge.co/v1/run",
    params={"input": "Hello World", "operations": "slugify,reverse"}
)
print(response.json())`,
    javascript: `const response = await fetch(
  "https://textforge.co/v1/run?input=Hello%20World&operations=slugify,reverse"
);
const data = await response.json();
console.log(data);`
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              API Online · All Systems Operational
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              The Swiss Army Knife for<br />
              <span className="text-blue-600">Text Transformations</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              28 transformation utilities through a single, simple endpoint.
              Slugify, camelcase, morse code, and more. No authentication required.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <BookOpen className="w-5 h-5" />
                Read the Docs
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <Users className="w-5 h-5" />
                Get API Key
              </Link>
            </div>
          </div>

          {/* Code Example */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-gray-950 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-sm text-gray-400 font-mono">API Request</span>
              </div>
              <div className="flex">
                <div className="flex flex-col gap-1 p-2 bg-gray-900 border-r border-gray-800">
                  {['curl', 'python', 'javascript'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                        activeTab === tab 
                          ? 'bg-gray-700 text-white' 
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
                    <code>{codeSnippets[activeTab]}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-lg text-gray-600">Built for developers, by developers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <Layers className="w-6 h-6" />, title: '28 Transformations', description: 'From slugify to morse code, all text transformations in one API.', color: 'blue' },
              { icon: <Code2 className="w-6 h-6" />, title: 'Pipeline Chaining', description: 'Combine multiple transformations in a single request.', color: 'green' },
              { icon: <Zap className="w-6 h-6" />, title: 'Lightning Fast', description: 'Sub-5ms response times. Optimized for performance.', color: 'yellow' },
              { icon: <Shield className="w-6 h-6" />, title: 'Rate Limiting', description: 'Built-in rate limiting with generous free tier (1K req/day).', color: 'red' },
              { icon: <Settings2 className="w-6 h-6" />, title: 'Batch Processing', description: 'Process multiple texts in a single request. Up to 100 items.', color: 'purple' },
              { icon: <Globe className="w-6 h-6" />, title: 'Webhook Delivery', description: 'Async result delivery via webhooks. Fire-and-forget processing.', color: 'orange' },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-lg bg-${feature.color}-100 flex items-center justify-center text-${feature.color}-600 mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transformations List */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">28 Transformations</h2>
            <p className="text-lg text-gray-600">All operations available on every transformation</p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            {transformations.map((transformation) => (
              <div
                key={transformation}
                className="px-4 py-2 bg-gray-100 rounded-lg font-mono text-sm text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {transformation}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-xl text-blue-100 mb-8">1,000 requests/day free. No credit card required.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            Get Your Free API Key
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
