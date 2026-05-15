import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../../api/client';

type ImportMeta = {
  sheetName?: string;
  rowCount?: number;
  taskCount?: number;
  skippedCount?: number;
  importedAt?: string;
  importedByUserId?: string;
  undoExpiresAt?: string;
  unresolvedOwners?: { row: number; raw: string }[];
};

type Props = {
  projectId: string;
  boardId: string;
  boardSettings: Record<string, unknown> | undefined;
  canManage: boolean;
};

type TenantMember = { userId?: string; email?: string; firstName?: string; lastName?: string };

export function ImportBanner({ projectId, boardId, boardSettings, canManage }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = (boardSettings?.importMeta ?? null) as ImportMeta | null;
  const [now, setNow] = useState(() => Date.now());
  const [resolvingBanner, setResolvingBanner] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const undoExpiresAt = meta?.undoExpiresAt ? Date.parse(meta.undoExpiresAt) : null;
  const undoMsLeft = undoExpiresAt ? Math.max(0, undoExpiresAt - now) : 0;
  const undoActive = undoMsLeft > 0;

  const unresolved = useMemo(() => {
    const list = meta?.unresolvedOwners ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of list) {
      const k = u.raw.trim();
      if (!k || seen.has(k.toLowerCase())) continue;
      seen.add(k.toLowerCase());
      out.push(k);
    }
    return out;
  }, [meta]);

  const membersQ = useQuery({
    queryKey: ['tenant-employees-for-banner'],
    enabled: resolvingBanner && unresolved.length > 0 && canManage,
    queryFn: () =>
      apiJson<{ employees: TenantMember[] }>('/employees').catch(() => ({ employees: [] as TenantMember[] })),
  });

  const undoMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}/boards/${boardId}/undo-import`, { method: 'POST' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? 'Undo failed');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/app/projects/${projectId}`);
    },
  });

  const bulkAddMut = useMutation({
    mutationFn: async (entries: { email?: string; userId?: string }[]) => {
      const res = await apiFetch(`/projects/${projectId}/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entries.map((e) =>
            e.userId
              ? { userId: e.userId, role: 'CONTRIBUTOR' }
              : { email: e.email, role: 'CONTRIBUTOR', invitationRole: 'EMPLOYEE' }
          ),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Bulk add failed');
      return body as { added: unknown[]; invited: unknown[]; errors: unknown[] };
    },
  });

  if (!meta || dismissed) return null;

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const tenantMembers = membersQ.data?.employees ?? [];
  function findMember(raw: string): TenantMember | null {
    const lc = raw.trim().toLowerCase();
    return (
      tenantMembers.find((m) => (m.email ?? '').toLowerCase() === lc) ??
      tenantMembers.find(
        (m) =>
          `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase() === lc ||
          (m.firstName ?? '').trim().toLowerCase() === lc
      ) ??
      null
    );
  }

  type Candidate = { userId?: string; email?: string };
  const candidatePayloads: Candidate[] = unresolved
    .map<Candidate | null>((raw) => {
      const m = findMember(raw);
      if (m?.userId) return { userId: m.userId };
      if (isEmail(raw)) return { email: raw };
      return null;
    })
    .filter((x): x is Candidate => x !== null);

  const mm = Math.floor(undoMsLeft / 60000);
  const ss = Math.floor((undoMsLeft % 60000) / 1000);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-sm text-indigo-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            Imported {meta.taskCount ?? 0} tasks from {meta.sheetName ?? 'spreadsheet'}.
            {(meta.skippedCount ?? 0) > 0 ? ` ${meta.skippedCount} skipped (no title).` : ''}
          </p>
          {undoActive && canManage && (
            <p className="mt-0.5 text-xs">
              You can undo this import for{' '}
              <span className="font-mono">
                {mm}:{String(ss).padStart(2, '0')}
              </span>{' '}
              more.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {undoActive && canManage && (
            <button
              type="button"
              disabled={undoMut.isPending}
              onClick={() => undoMut.mutate()}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              {undoMut.isPending ? 'Undoing…' : 'Undo import'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-xl border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-900 hover:bg-white"
          >
            Dismiss
          </button>
        </div>
      </div>

      {unresolved.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p className="text-xs font-semibold">
            {unresolved.length} owner reference{unresolved.length === 1 ? '' : 's'} could not be matched to an
            existing user:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1 text-[11px]">
            {unresolved.slice(0, 20).map((n) => (
              <li key={n} className="rounded bg-white/80 px-2 py-0.5 ring-1 ring-amber-200">
                {n}
              </li>
            ))}
            {unresolved.length > 20 && <li>+{unresolved.length - 20} more</li>}
          </ul>
          {canManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={candidatePayloads.length === 0 || bulkAddMut.isPending}
                onClick={() => bulkAddMut.mutate(candidatePayloads)}
                className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {bulkAddMut.isPending
                  ? 'Working…'
                  : `Add ${candidatePayloads.length} matchable references`}
              </button>
              <button
                type="button"
                onClick={() => setResolvingBanner((v) => !v)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                {resolvingBanner ? 'Hide matcher' : 'Refresh tenant directory'}
              </button>
            </div>
          )}
          {bulkAddMut.isSuccess && (
            <p className="mt-2 text-[11px] text-amber-900">
              Added {bulkAddMut.data?.added.length ?? 0} member(s);{' '}
              {bulkAddMut.data?.invited.length ?? 0} invitation(s) sent.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
