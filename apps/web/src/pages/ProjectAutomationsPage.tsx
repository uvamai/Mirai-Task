import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '../api/client';

type When = { field: 'status' | 'priority'; op: 'eq'; value: string };
type ThenWebhook = { action: 'webhook'; event: string };
type ThenPriority = { action: 'set_priority'; value: string };
type Rule = { id: string; when: When; then: ThenWebhook | ThenPriority };

const EVENT_OPTS = ['task.assigned', 'task.updated', 'sla.warning', 'sla.soft_breach'] as const;

export function ProjectAutomationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ['me-automations'],
    queryFn: () => apiJson<{ membership: { role: string } }>('/auth/me'),
  });
  const pq = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: { id: string; name: string; settings?: Record<string, unknown> }[] }>('/projects'),
  });
  const project = pq.data?.projects.find((p) => p.id === projectId);
  const rawRules = project?.settings?.automations;
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (Array.isArray(rawRules)) {
      setRules(
        rawRules.filter((r): r is Rule => {
          if (!r || typeof r !== 'object') return false;
          const o = r as Record<string, unknown>;
          return (
            typeof o.id === 'string' &&
            Boolean(o.when) &&
            typeof o.when === 'object' &&
            Boolean(o.then) &&
            typeof o.then === 'object'
          );
        })
      );
    } else {
      setRules([]);
    }
  }, [rawRules]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automations: rules }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  if (!projectId) return null;
  if (meQ.data?.membership.role !== 'ADMIN') {
    return <Navigate to={`/app/projects/${projectId}`} replace />;
  }

  const addRule = () => {
    const id = `rule_${Date.now().toString(36)}`;
    setRules((prev) => [
      ...prev,
      {
        id,
        when: { field: 'status', op: 'eq', value: 'In Progress' },
        then: { action: 'webhook', event: 'task.updated' },
      },
    ]);
  };

  const updateRule = (idx: number, next: Rule) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? next : r)));
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Automations</h2>
        <p className="mt-1 text-sm text-slate-600">
          When a task&apos;s status or priority changes, run a webhook or adjust priority. Admin only; rules run after
          each task update.
        </p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <p className="text-xs text-slate-500">
          Project: <span className="font-semibold text-slate-800">{project?.name ?? projectId}</span>
        </p>

        <div className="mt-4 space-y-4">
          {rules.map((rule, i) => (
            <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{rule.id}</span>
                <button
                  type="button"
                  className="text-xs text-rose-700 hover:underline"
                  onClick={() => removeRule(i)}
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  When field
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                    value={rule.when.field}
                    onChange={(e) =>
                      updateRule(i, {
                        ...rule,
                        when: { ...rule.when, field: e.target.value as When['field'] },
                      })
                    }
                  >
                    <option value="status">status</option>
                    <option value="priority">priority</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Equals
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                    value={rule.when.value}
                    onChange={(e) =>
                      updateRule(i, {
                        ...rule,
                        when: { ...rule.when, value: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Then action
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                    value={rule.then.action}
                    onChange={(e) => {
                      const a = e.target.value;
                      if (a === 'webhook') {
                        updateRule(i, { ...rule, then: { action: 'webhook', event: 'task.updated' } });
                      } else {
                        updateRule(i, { ...rule, then: { action: 'set_priority', value: 'P3' } });
                      }
                    }}
                  >
                    <option value="webhook">webhook</option>
                    <option value="set_priority">set_priority</option>
                  </select>
                </label>
                {rule.then.action === 'webhook' ? (
                  <label className="text-xs font-semibold text-slate-600">
                    Webhook event
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                      value={rule.then.event}
                      onChange={(e) =>
                        updateRule(i, {
                          ...rule,
                          then: { action: 'webhook', event: e.target.value },
                        })
                      }
                    >
                      {EVENT_OPTS.map((ev) => (
                        <option key={ev} value={ev}>
                          {ev}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-slate-600">
                    New priority
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                      value={rule.then.value}
                      onChange={(e) =>
                        updateRule(i, {
                          ...rule,
                          then: { action: 'set_priority', value: e.target.value },
                        })
                      }
                    >
                      {(['P0', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
            onClick={addRule}
          >
            Add rule
          </button>
        </div>

        {save.isError && <p className="mt-2 text-sm text-rose-700">{(save.error as Error).message}</p>}
        {save.isSuccess && <p className="mt-2 text-sm text-emerald-800">Saved.</p>}

        <button
          type="button"
          disabled={save.isPending}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save automations'}
        </button>
      </div>
    </div>
  );
}
