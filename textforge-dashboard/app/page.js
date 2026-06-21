import Link from 'next/link';
import { ArrowRight, Zap, Shield, Globe, Code2, Link2, Clock, Layers, Cpu, BarChart3, Check, ChevronRight } from 'lucide-react';
import Pricing from '../components/Pricing';

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: '23 Transformations',
    description: 'From slugify to morse code, all text transformations in one API.'
  },
  {
    icon: <Code2 className="w-6 h-6" />,
    title: 'Developer First',
    description: 'Simple REST API, comprehensive docs, and code examples in every language.'
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: 'Chain Operations',
    description: 'Combine multiple transformations in a single request for complex operations.'
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: 'Lightning Fast',
    description: 'Optimized for speed with sub-5ms response times for each transformation.'
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Rate Limiting',
    description: 'Built-in rate limiting with generous free tier to protect your usage.'
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Global Edge',
    description: 'Deployed globally for low latency no matter where your users are.'
  }
];

const transformations = [
  'slugify', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase',
  'constantcase', 'sentencecase', 'titlecase', 'reverse', 'countwords',
  'removemultiple', 'removespecial', 'extractemails', 'extracturls',
  'extractnumbers', 'truncate', 'leet', 'morse', 'base64encode',
  'base64decode', 'hash', 'random', 'palindromecheck'
];

const codeExample = `curl -X GET "https://api.textforge.co/transform?text=Hello%20World!&action=slugify"`;

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
        <div className="absolute inset-0 bg-grid-gray-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 text-primary-700 text-sm font-medium mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary-600 mr-2"></span>
              Now with 23 text transformations
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              The Swiss Army Knife for{' '}
              <span className="text-primary-600">Text Transformations</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              23 text utilities through a single, simple endpoint. Slugify, camelcase, morse code, base64, and more. No libraries required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/docs" className="btn-primary">
                Read the Docs <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Get API Key
              </Link>
            </div>
          </div>

          {/* Code Example */}
          <div className="max-w-2xl mx-auto">
            <div className="code-block">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <pre className="text-gray-300">{codeExample}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From URL slugs to Morse code, TextForge has you covered with fast, reliable text transformations.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transformations Grid */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">23 Transformations</h2>
            <p className="text-xl text-gray-600">All available in a single API call</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {transformations.map((transform) => (
              <span key={transform} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-700">
                {transform}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing />

      {/* CTA Section */}
      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-xl text-primary-100 mb-8">
            Start with our generous free tier. No credit card required.
          </p>
          <Link href="/dashboard" className="btn-secondary">
            Get Your Free API Key <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
