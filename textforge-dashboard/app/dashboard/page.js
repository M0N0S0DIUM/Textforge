'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Trash2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function Dashboard() {
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState([]);
  const [plan, setPlan] = useState('Free');

  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
  }, []);

  // Fetch API keys
  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const response = await fetch(`${API_URL}/api/keys`);
        const data = await response.json();
        if (data.success) {
          setKeys(data.keys);
          if (data.keys.length > 0) {
            setApiKey(data.keys[0].key);
            setPlan(data.keys[0].tier === 'pro' ? 'Pro' : 'Free');
          }
        }
      } catch (err) {
        console.error('Failed to fetch keys:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate your API key? Your old key will be revoked.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/keys`, { method: 'POST' });
      const data = await response.json();
      if (data.success && data.key) {
        setApiKey(data.key.key);
        setKeys([data.key]);
      } else {
        console.error('Failed to regenerate key:', data.error);
      }
    } catch (err) {
      console.error('Failed to regenerate key:', err);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke your API key? You will lose access to Pro features.')) {
      return;
    }

    try {
      if (keys.length > 0 && keys[0].id) {
        await fetch(`${API_URL}/api/keys/${keys[0].id}`, { method: 'DELETE' });
      }
      setApiKey('');
      setKeys([]);
      setPlan('Free');
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const usagePercent = stats ? Math.min((stats.totalRequests / 50000) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your API keys and monitor usage</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">API Key</div>
          <div className="flex items-center gap-2">
            <code className="text-lg text-gray-900 font-mono truncate">{apiKey || 'No active key'}</code>
            {apiKey && (
              <button onClick={handleCopy} className="p-2 hover:bg-gray-100 rounded">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            )}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Requests Today</div>
          <div className="text-2xl font-bold text-gray-900">{stats ? stats.totalRequests.toLocaleString() : '0'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Plan</div>
          <div className="text-2xl font-bold text-primary-600">{plan}</div>
          <div className="text-sm text-gray-500">{plan === 'Pro' ? 'Upgrade for more' : 'Upgrade for more'}</div>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="card mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600">Daily Usage</span>
          <span className="text-sm text-gray-600">{stats ? stats.totalRequests.toLocaleString() : '0'} / 50,000</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* API Key Management */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">API Key Management</h2>
        {apiKey ? (
          <div className="flex gap-4">
            <button
              onClick={handleRegenerate}
              className="btn-secondary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Key
            </button>
            <button 
              onClick={handleRevoke}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Revoke Key
            </button>
          </div>
        ) : (
          <p className="text-gray-600">No active API key. Upgrade to Pro to get one.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">API Documentation</h3>
          <p className="text-gray-600 mb-4">Explore all available transformations and endpoints.</p>
          <a href="/docs" className="text-primary-600 hover:text-primary-700 font-medium">
            View Docs →
          </a>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upgrade Plan</h3>
          <p className="text-gray-600 mb-4">Get more requests, webhooks, and priority support.</p>
          <a href="/billing" className="text-primary-600 hover:text-primary-700 font-medium">
            Upgrade Now →
          </a>
        </div>
      </div>
    </div>
  );
}
