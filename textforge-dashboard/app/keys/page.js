'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Trash2, Key, Plus, RefreshCw } from 'lucide-react';
import { keys, getToken } from '../../lib/api';

export default function Keys() {
  const router = useRouter();
  const [keyList, setKeyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [message, setMessage] = useState(null);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=keys');
      return;
    }
    loadKeys();
  }, [router]);

  async function loadKeys() {
    setLoading(true);
    try {
      const data = await keys.list();
      if (data.success) setKeyList(data.keys);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load API keys.' });
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreatingKey(true);
    setMessage(null);
    try {
      const data = await keys.create(newKeyName || undefined);
      if (data.success) {
        setKeyList([data.key, ...keyList]);
        setNewKeyName('');
        setMessage({ type: 'success', text: `API key "${data.key.name}" created. Copy it now — it won't be shown again in full.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create API key.' });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevoke = async (keyId, keyName) => {
    if (!confirm(`Revoke the key "${keyName}"? This cannot be undone.`)) return;
    setRevoking(keyId);
    setMessage(null);
    try {
      await keys.revoke(keyId);
      setKeyList(keyList.map((k) => k.id === keyId ? { ...k, revoked: 1 } : k));
      setMessage({ type: 'success', text: `Key "${keyName}" has been revoked.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke key.' });
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const activeKeys = keyList.filter((k) => !k.revoked);
  const revokedKeys = keyList.filter((k) => k.revoked);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
        <p className="text-gray-600 mt-2">Create and manage API keys for the TextForge API</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border text-sm ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Create Key */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Create New Key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button type="submit" disabled={creatingKey} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
            {creatingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Key
          </button>
        </form>
      </div>

      {/* Active Keys */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Keys ({activeKeys.length})</h2>
        {activeKeys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No active API keys. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{k.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      k.tier === 'pro' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {k.tier}
                    </span>
                    <span className="text-xs text-gray-400">
                      Created {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <code className="text-xs font-mono text-gray-600 block truncate">{k.key}</code>
                </div>
                <button onClick={() => handleCopy(k.key)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 flex-shrink-0" title="Copy">
                  {copiedKey === k.key ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleRevoke(k.id, k.name)}
                  disabled={revoking === k.id}
                  className="p-1.5 hover:bg-red-100 rounded text-red-500 flex-shrink-0"
                  title="Revoke"
                >
                  {revoking === k.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div className="card opacity-60">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Revoked Keys</h2>
          <div className="space-y-2">
            {revokedKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-400">{k.name}</span>
                  <code className="text-xs font-mono text-gray-400 block truncate">{k.key}</code>
                </div>
                <span className="text-xs text-red-400 font-medium flex-shrink-0">Revoked</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage info */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Using your API key:</strong> Include the key in the{' '}
        <code className="bg-blue-100 px-1 rounded">X-API-Key</code> header.
        <br />
        <code className="mt-1 block bg-blue-100 p-2 rounded font-mono text-xs mt-2">
          {`curl -H "X-API-Key: YOUR_KEY" "${process.env.NEXT_PUBLIC_API_URL || 'https://api.textforge.co'}/transform?text=hello&action=slugify"`}
        </code>
      </div>
    </div>
  );
}
