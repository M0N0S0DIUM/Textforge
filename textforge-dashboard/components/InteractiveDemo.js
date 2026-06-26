'use client';

import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';

const ACTIONS = {
  slugify: (text) => text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''),
  reverse: (text) => text.split('').reverse().join(''),
  base64encode: (text) => btoa(text),
  base64decode: (text) => { try { return atob(text); } catch(e) { return '(invalid base64)'; } },
  camelcase: (text) => { const parts = text.toLowerCase().split(/[\s_-]+/); return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join(''); },
  snakecase: (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase(),
  kebabcase: (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(),
  uppercase: (text) => text.toUpperCase(),
  lowercase: (text) => text.toLowerCase(),
  titlecase: (text) => text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
  sentencecase: (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  removespecial: (text) => text.replace(/[^a-zA-Z0-9\s]/g, ''),
  trim: (text) => text.trim(),
  pascalcase: (text) => text.split(/[\s_-]+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(''),
  countwords: (text) => `Words: ${text.trim().split(/\s+/).length} | Chars: ${text.length}`,
};

const DEMO_ACTIONS = Object.keys(ACTIONS);

export default function InteractiveDemo() {
  const [input, setInput] = useState('Hello World! This is a test.');
  const [pipeline, setPipeline] = useState(['slugify', 'reverse', 'base64encode']);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runPipeline = () => {
    setLoading(true);
    const steps = [];
    let current = input;
    for (let i = 0; i < pipeline.length; i++) {
      const action = pipeline[i];
      const fn = ACTIONS[action];
      current = fn ? fn(typeof current === 'object' ? JSON.stringify(current) : String(current)) : current;
      steps.push({ step: i + 1, action, result: current });
    }
    setResult({ result: current, steps });
    setLoading(false);
  };

  const addAction = () => {
    const available = DEMO_ACTIONS.filter(a => !pipeline.includes(a));
    if (available.length > 0) setPipeline([...pipeline, available[0]]);
  };

  const removeAction = (index) => setPipeline(pipeline.filter((_, i) => i !== index));

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Try the Pipeline Builder</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Chain multiple transformations together. Each step feeds into the next.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Input Text</label>
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline Steps</label>
              <div className="space-y-2">
                {pipeline.map((action, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                      Step {index + 1}
                    </span>
                    <select value={action} onChange={(e) => {
                      const newPipeline = [...pipeline];
                      newPipeline[index] = e.target.value;
                      setPipeline(newPipeline);
                    }} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm">
                      {DEMO_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <button onClick={() => removeAction(index)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-bold">x</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={addAction} className="text-sm text-primary-600 hover:text-primary-700">+ Add Step</button>
              </div>
            </div>
            <button onClick={runPipeline} disabled={loading || !input || pipeline.length === 0}
              className="btn-primary w-full disabled:opacity-50">
              {loading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running...</> : <><Play className="w-4 h-4 mr-2" />Run Pipeline</>}
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Final Result</label>
              <pre className="min-h-24 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto font-mono text-sm">
                {result?.result || 'Run a pipeline to see results...'}
              </pre>
            </div>
            {result?.steps && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Step-by-Step Breakdown</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {result.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded">
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">Step {step.step}</span>
                      <code className="font-mono font-semibold">{step.action}</code>
                      <span className="text-gray-500 truncate flex-1">{typeof step.result === 'string' ? step.result : JSON.stringify(step.result)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
