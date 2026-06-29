'use client';

import Link from 'next/link';

const releases = [
  { version: '1.0.0', date: '2025-01-15', changes: ['Initial release with 28 transformations', 'API key authentication', 'Rate limiting'] },
  { version: '0.9.0', date: '2024-12-01', changes: ['Beta testing', 'Custom presets (Pro)', 'Analytics dashboard'] },
];

export default function Changelog() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Changelog</h1>
      <div className="space-y-8">
        {releases.map((release) => (
          <div key={release.version} className="card">
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xl font-semibold text-gray-900">v{release.version}</h2>
              <span className="text-sm text-gray-500">{release.date}</span>
            </div>
            <ul className="space-y-1">
              {release.changes.map((change, i) => (
                <li key={i} className="text-sm text-gray-600">• {change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/docs" className="text-primary-600 hover:underline">← Back to Docs</Link>
      </div>
    </div>
  );
}
