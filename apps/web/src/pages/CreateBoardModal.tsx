import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api/client';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { boardShellAppPath } from '../hooks/useBoardShellView';

type Template = {
  templateKey: string;
  label: string;
  businessType: string;
  defaultStages: string[];
  sampleTasks: { title: string; status: string; priority: string }[];
};

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
};

export function CreateBoardModal({ projectId, open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  const templatesQ = useQuery({
    queryKey: ['board-templates'],
    enabled: open,
    queryFn: () => apiJson<{ templates: Template[] }>('/public/board-templates'),
    select: (d) => d.templates,
  });

  const create = useMutation({
    mutationFn: async (payload: { name: string; templateKey: string }) => {
      const res = await apiFetch(`/projects/${projectId}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Create failed');
      return body as { id: string };
    },
    onSuccess: (data) => {
      onCreated(data.id);
      navigate(boardShellAppPath(projectId, data.id));
      setName('');
      setSelected(null);
      setPreview(null);
      onClose();
    },
  });

  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, open);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create board"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-slate-900">Create board</h2>
        <p className="mt-1 text-xs text-slate-600">Pick a template, preview columns, then name your board.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Board name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Sprint 24"
            />
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templatesQ.data?.map((t) => (
                <button
                  key={t.templateKey}
                  type="button"
                  onClick={() => {
                    setSelected(t.templateKey);
                    setPreview(t);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selected === t.templateKey
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{t.label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{t.businessType}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <h3 className="text-xs font-bold uppercase text-slate-600">Preview</h3>
            {preview ? (
              <div className="mt-2 space-y-2 text-xs">
                <p className="font-medium text-slate-800">Columns: {preview.defaultStages.join(' → ')}</p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {preview.defaultStages.map((col) => (
                    <div
                      key={col}
                      className="min-w-[4.5rem] flex-shrink-0 rounded-lg border border-slate-200 bg-white/90 px-1 py-1 text-center text-[10px] font-semibold text-slate-700"
                    >
                      {col}
                    </div>
                  ))}
                </div>
                <ul className="space-y-1 text-slate-600">
                  {preview.sampleTasks.map((s, i) => (
                    <li key={i} className="rounded-lg bg-white px-2 py-1 shadow-sm">
                      <span className="font-semibold text-slate-800">{s.title}</span>
                      <span className="text-slate-400"> · {s.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Select a template to preview.</p>
            )}
          </div>
        </div>

        {create.isError && <p className="mt-2 text-sm text-rose-700">{(create.error as Error).message}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || !selected || create.isPending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => selected && create.mutate({ name: name.trim(), templateKey: selected })}
          >
            {create.isPending ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </div>
    </div>
  );
}
