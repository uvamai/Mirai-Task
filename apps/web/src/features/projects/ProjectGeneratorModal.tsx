import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../api/client';

export function ProjectGeneratorModal({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [template, setTemplate] = useState('IT / Software Development');
  const [keyRequirements, setKeyRequirements] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const generateProject = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, techStack, template, keyRequirements }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate project');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['board-meta'] });
      onClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        >
          <h2 className="text-xl font-bold text-slate-900">AI Project Generator</h2>
          <p className="mt-1 text-sm text-slate-600">Provide the details below and AI will draft a PRD, timeline, and task backlog for you.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Industry / Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="IT / Software Development">IT / Software Development</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Construction">Construction</option>
                <option value="Retail">Retail</option>
                <option value="Marketing Campaign">Marketing Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Project Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Build a new mobile application for our retail store..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Tech Stack / Tools</label>
              <input
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. React Native, Node.js, PostgreSQL"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Key Requirements</label>
              <textarea
                value={keyRequirements}
                onChange={(e) => setKeyRequirements(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Must support offline mode, integrated with Stripe for payments..."
              />
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={generateProject.isPending}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={() => generateProject.mutate()}
              disabled={generateProject.isPending || !description || !techStack}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {generateProject.isPending ? 'Generating...' : 'Generate Project'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
