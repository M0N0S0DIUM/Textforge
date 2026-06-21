'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Key, BarChart2, Zap, ArrowRight, RefreshCw } from 'lucide-react';
import { users, keys, getToken } from '../../lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=dashboard');
      return;
    }
    loadAll();
  }, [router]);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsData, keysData, histData] = await Promise.all([
        users.stats(),
        keys.list(),
        users.history(5, 0),
      ]);
      if (statsData.success) setStats(statsData.stats);
      if (keysData.success) setApiKeys(keysData.keys);
      if (histData.success) setHistory(histData.history);

      const storedUser = localStorage.getItem('tf_user');
      if (storedUser) setUserData(JSON.parse(storedUser));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      const data = await keys.create('My API Key');
      if (data.success) setApiKeys([data.key, ...apiKeys]);
    } catch (err) {
      console.error('Create key error:', err);
    } finally {
      setCreatingKey(false);
    }
  };

  const usagePercent = stats
    ? Math.min((stats.requestsToday / stats.dailyLimit) * 100, 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const activeKey = apiKeys.find((k) => !k.revoked);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome{userData?.name ? `, ${userData.name}` : ' back'}
        </h1>
        <p className="text-gray-600 mt-2">Here's your API overview</p>
      </div>

      {/* Stats row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Requests Today</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.requestsToday?.toLocaleString() ?? '0'}</p>
          <p className="text-xs text-gray-400 mt-1">of {stats?.dailyLimit?.toLocaleString() ?? '1,000'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalRequests?.toLocaleString() ?? '0'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Top Transformation</p>
          <p className="text-xl font-bold text-primary-600 font-mono">{stats?.topAction ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Plan</p>
          <p className={`text-2xl font-bold ${stats?.tier === 'pro' ? 'text-green-600' : 'text-gray-900'}`}>
            {stats?.tier ? stats.tier.charAt(0).toUpperCase() + stats.tier.slice(1) : 'Free'}
          </p>
          {stats?.tier !== 'pro' && (
            <Link href="/billing" className="text-xs text-primary-600 hover:underline">Upgrade →</Link>
          )}
        </div>
      </div>

      {/* Daily usage bar */}
      <div className="card mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary-600" /> Daily Usage
          </span>
          <span className="text-sm text-gray-500">
            {stats?.requestsToday?.toLocaleString() ?? 0} / {stats?.dailyLimit?.toLocaleString() ?? '1,000'}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : 'bg-primary-600'}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {usagePercent > 80 && (
          <p className="text-xs text-orange-600 mt-1">
            You're using {usagePercent.toFixed(0)}% of your daily limit.{' '}
            <Link href="/billing" className="underline">Upgrade for more.</Link>
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* API Key */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-4 h-4" /> API Key
            </h2>
            <Link href="/keys" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeKey ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <code className="flex-1 text-xs font-mono text-gray-700 truncate">{activeKey.key}</code>
              <button onClick={() => handleCopy(activeKey.key)} className="p-1 hover:bg-gray-200 rounded">
                {copiedKey === activeKey.key
                  ? <Check className="w-4 h-4 text-green-500" />
                  : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No active API key.</p>
              <button
                onClick={handleCreateKey}
                disabled={creatingKey}
                className="btn-primary text-sm py-1.5 px-3"
              >
                {creatingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create API Key'}
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Quick Links
          </h2>
          <div className="space-y-2">
            {[
              { href: '/playground', label: 'API Playground', sub: 'Test transformations interactively' },
              { href: '/docs', label: 'Documentation', sub: 'Full API reference' },
              { href: '/keys', label: 'API Keys', sub: 'Manage your keys' },
              { href: '/billing', label: 'Billing', sub: 'Manage subscription' },
            ].map(({ href, label, sub }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transformations</h2>
          <div className="divide-y divide-gray-50">
            {history.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-mono text-primary-600 text-xs bg-primary-50 px-2 py-0.5 rounded">
                  {item.action}
                </span>
                <span className="text-gray-500 text-xs">
                  {item.input_length} → {item.output_length} chars
                </span>
                <span className="text-gray-400 text-xs">
                  {new Date(item.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
          <Link href="/keys" className="block text-center text-sm text-primary-600 hover:underline mt-3">
            View all history →
          </Link>
        </div>
      )}
    </div>
  );
}
