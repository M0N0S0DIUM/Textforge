'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Trash2, Key } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [message, setMessage] = useState(null);

  // Fetch API keys
  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const response = await fetch(`${API_URL}/api/keys`);
        const data = await response.json();
        if (data.success) {
          setKeys(data.keys);
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to fetch API keys.' });
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, []);

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to generate a new API key? Your old keys will remain active until revoked.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/keys`, { method: 'POST' });
      const data = await response.json();
      if (data.success && data.key) {
        setKeys([data.key, ...keys]);
        setMessage({ type: 'success', text: 'New API key generated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate new key.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to generate new key.' });
    }
  };

  const handleRevoke = async (keyId) => {
    if (!confirm('Are you sure you want to revoke this API key? You will lose access to Pro features with this key.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/keys/${keyId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setKeys(keys.filter((k) => k.id !== keyId));
        setMessage({ type: 'success', text: 'API key revoked successfully.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to revoke key.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to revoke key.' });
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
        <p className="text-gray-600 mt-2">Manage your API keys for accessing TextForge</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {/* Generate New Key */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Generate New Key</h2>
            <p className="text-gray-600 mt-1">Create a new Pro API key for your applications.</p>
          </div>
          <button
            onClick={handleRegenerate}
            className="btn-primary flex items-center"
          >
            <Key className="w-4 h-4 mr-2" />
            Generate Key
          </button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your API Keys</h2>
        {keys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No API keys yet. Generate a new key to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map((keyData) => (
              <div key={keyData.id || keyData.key} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        keyData.tier === 'pro' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {keyData.tier.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        Created {new Date(keyData.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <code className="text-lg text-gray-900 font-mono">{keyData.key}</code>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleCopy(keyData.key)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Copy key"
                    >
                      {copiedKey === keyData.key ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(keyData.id)}
                      className="p-2 hover:bg-red-50 rounded text-red-600"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="card mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">API Key Usage</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Free Tier</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 1,000 requests/day</li>
              <li>• No API key required</li>
              <li>• All 23 transformations</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Pro Tier</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 50,000 requests/day</li>
              <li>• API key required (tf_pro_...)</li>
              <li>• Priority support</li>
              <li>• Webhook delivery</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
