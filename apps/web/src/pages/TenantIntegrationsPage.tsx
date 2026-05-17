import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiJson } from '../api/client';

export function TenantIntegrationsPage() {
  const qc = useQueryClient();
  const [openaiKey, setOpenaiKey] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const intQ = useQuery({
    queryKey: ['tenant-integrations'],
    queryFn: () => apiJson<{ integrations: Array<{ id: string; provider: string; status: string; updatedAt: string }> }>('/integrations'),
  });

  const saveAiKey = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/integrations/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', apiKey: openaiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save key');
      return data;
    },
    onSuccess: () => {
      setSuccessMsg('OpenAI API Key saved successfully');
      setErrorMsg('');
      setOpenaiKey('');
      void qc.invalidateQueries({ queryKey: ['tenant-integrations'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setSuccessMsg('');
    },
  });

  const openaiIntegration = intQ.data?.integrations.find(i => i.provider === 'openai');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations & AI</h1>
        <p className="mt-1 text-sm text-slate-600">Manage third-party integrations and Bring Your Own Key (BYOK) for AI features.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-md">
        <h2 className="text-lg font-bold text-slate-900">AI Provider Key (BYOK)</h2>
        <p className="mt-1 text-sm text-slate-600">Provide your own OpenAI API key to enable AI project generation features. Your key is stored securely with symmetric encryption.</p>

        {openaiIntegration && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 border border-emerald-200">
            <span className="font-semibold">Status: Active</span>
            <span>(Last updated: {new Date(openaiIntegration.updatedAt).toLocaleDateString()})</span>
          </div>
        )}

        <div className="mt-6 max-w-md">
          <label className="block text-sm font-semibold text-slate-700">OpenAI API Key</label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {errorMsg && <p className="mt-2 text-sm text-rose-600">{errorMsg}</p>}
          {successMsg && <p className="mt-2 text-sm text-emerald-600">{successMsg}</p>}
          <button
            onClick={() => saveAiKey.mutate()}
            disabled={saveAiKey.isPending || !openaiKey}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saveAiKey.isPending ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
