import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, apiFetch } from '../api/client';

type FormField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
};

type FormRow = {
  id: string;
  title: string;
  description: string;
  boardId: string;
  fields: FormField[];
  isActive: boolean;
  createdAt: string;
};

type BoardRow = {
  id: string;
  name: string;
};

export function ProjectFormsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const formsQ = useQuery({
    queryKey: ['forms', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiJson<{ forms: FormRow[] }>(`/projects/${projectId}/forms`),
  });

  const boardsQ = useQuery({
    queryKey: ['boards', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiJson<{ boards: BoardRow[] }>(`/projects/${projectId}/boards`),
  });

  const activeForm = formsQ.data?.forms.find((f) => f.id === selectedFormId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const firstBoardId = boardsQ.data?.boards[0]?.id;
      if (!firstBoardId) throw new Error('No boards found in project');
      const res = await apiFetch(`/projects/${projectId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Intake Form',
          boardId: firstBoardId,
          fields: [],
        }),
      });
      return res.json() as Promise<FormRow>;
    },
    onSuccess: (newForm) => {
      void qc.invalidateQueries({ queryKey: ['forms', projectId] });
      setSelectedFormId(newForm.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<FormRow>) => {
      await apiFetch(`/projects/${projectId}/forms/${selectedFormId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['forms', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/projects/${projectId}/forms/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['forms', projectId] });
      setSelectedFormId(null);
    },
  });

  if (!projectId) return null;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6">
      {/* Sidebar */}
      <div className="flex w-72 flex-col gap-4 rounded-3xl border border-white/50 bg-white/40 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-bold text-slate-900">Intake Forms</h2>
          <button
            onClick={() => createMutation.mutate()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95"
          >
            +
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {formsQ.data?.forms.map((form) => (
            <div
              key={form.id}
              onClick={() => setSelectedFormId(form.id)}
              className={`group flex cursor-pointer flex-col rounded-xl px-3 py-2 text-sm transition ${
                selectedFormId === form.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-bold">{form.title}</span>
                {selectedFormId === form.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete form?')) deleteMutation.mutate(form.id);
                    }}
                    className="text-white/70 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${selectedFormId === form.id ? 'text-white/70' : 'text-slate-400'}`}>
                {boardsQ.data?.boards.find(b => b.id === form.boardId)?.name || 'Unknown Board'}
              </span>
            </div>
          ))}
          {formsQ.data?.forms.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-400 italic">No forms created yet.</p>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-white/50 bg-white/60 p-8 shadow-2xl backdrop-blur-xl custom-scrollbar">
        {selectedFormId && activeForm ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <input
                  value={activeForm.title}
                  onChange={(e) => updateMutation.mutate({ title: e.target.value })}
                  className="w-full bg-transparent text-3xl font-bold text-slate-900 focus:outline-none"
                  placeholder="Form Title"
                />
                <textarea
                  value={activeForm.description || ''}
                  onChange={(e) => updateMutation.mutate({ description: e.target.value })}
                  className="mt-2 w-full bg-transparent text-sm text-slate-500 focus:outline-none resize-none"
                  placeholder="Add a description for respondents..."
                  rows={2}
                />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/50 bg-white/40 px-3 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active</span>
                  <input
                    type="checkbox"
                    checked={activeForm.isActive}
                    onChange={(e) => updateMutation.mutate({ isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <button
                   onClick={() => alert(`Public URL: /public/forms/${activeForm.id}`)}
                   className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:underline"
                >
                  Copy Public Link
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/20 p-6 space-y-4 shadow-inner">
               <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Board</label>
               <select
                 value={activeForm.boardId}
                 onChange={(e) => updateMutation.mutate({ boardId: e.target.value })}
                 className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
               >
                 {boardsQ.data?.boards.map(b => (
                   <option key={b.id} value={b.id}>{b.name}</option>
                 ))}
               </select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Fields</h3>
                <button
                  onClick={() => {
                    const newFields = [...activeForm.fields, { id: crypto.randomUUID(), label: 'New Field', type: 'text', required: false }];
                    updateMutation.mutate({ fields: newFields as any });
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  + Add Field
                </button>
              </div>

              <div className="space-y-3">
                {activeForm.fields.map((field, idx) => (
                  <div key={field.id} className="group relative flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <input
                        value={field.label}
                        onChange={(e) => {
                          const newFields = [...activeForm.fields];
                          newFields[idx].label = e.target.value;
                          updateMutation.mutate({ fields: newFields as any });
                        }}
                        className="flex-1 bg-transparent font-semibold text-slate-900 focus:outline-none"
                        placeholder="Field Label"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => {
                          const newFields = [...activeForm.fields];
                          newFields[idx].type = e.target.value as any;
                          updateMutation.mutate({ fields: newFields as any });
                        }}
                        className="rounded-lg border-none bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 outline-none"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Dropdown</option>
                      </select>
                      <button
                        onClick={() => {
                          const newFields = activeForm.fields.filter((_, i) => i !== idx);
                          updateMutation.mutate({ fields: newFields as any });
                        }}
                        className="text-slate-300 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                    {field.type === 'select' && (
                      <input
                        value={field.options?.join(', ') || ''}
                        onChange={(e) => {
                          const newFields = [...activeForm.fields];
                          newFields[idx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          updateMutation.mutate({ fields: newFields as any });
                        }}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                        placeholder="Options (comma separated)"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => {
                          const newFields = [...activeForm.fields];
                          newFields[idx].required = e.target.checked;
                          updateMutation.mutate({ fields: newFields as any });
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Required Field</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center h-full text-center">
             <div className="mb-4 text-6xl opacity-20">📋</div>
             <h3 className="text-xl font-bold text-slate-900">Custom Intake Forms</h3>
             <p className="mt-2 text-sm text-slate-500 max-w-sm">
               Create custom forms to collect requirements, bug reports, or feedback directly into your project boards.
             </p>
             <button
               onClick={() => createMutation.mutate()}
               className="mt-6 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition"
             >
               Build Your First Form
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
