import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, apiJson } from '../api/client';

type Emp = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department: string | null;
};

type InvRow = {
  id: string;
  email: string;
  membershipRole: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export function EmployeesPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiJson<{ employees: Emp[] }>('/employees'),
  });

  const invQ = useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiJson<{ invitations: InvRow[] }>('/invitations'),
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, membershipRole: role }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string; acceptUrl?: string };
      if (!res.ok) throw new Error(b.error ?? 'Invite failed');
      return b.acceptUrl ?? null;
    },
    onSuccess: (acceptUrl) => {
      void qc.invalidateQueries({ queryKey: ['invitations'] });
      setEmail('');
      setLastAcceptUrl(typeof acceptUrl === 'string' ? acceptUrl : null);
    },
  });

  const rotate = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/invitations/${id}/rotate`, { method: 'POST' });
      const b = (await res.json().catch(() => ({}))) as { error?: string; acceptUrl?: string };
      if (!res.ok) throw new Error(b.error ?? 'Rotate failed');
      return b.acceptUrl as string;
    },
    onSuccess: (url) => {
      void qc.invalidateQueries({ queryKey: ['invitations'] });
      setLastAcceptUrl(url);
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/invitations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? 'Revoke failed');
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invitations'] }),
  });

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setLastAcceptUrl(text);
    } catch {
      setToastErr('Could not copy to clipboard');
    }
  }

  const [toastErr, setToastErr] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-sm text-slate-600">Employees and email invitations (Admin / Manager).</p>
      </div>

      {toastErr && (
        <p className="text-sm text-rose-700" role="alert">
          {toastErr}
        </p>
      )}

      <section className="rounded-2xl border border-white/50 bg-white/55 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h2 className="text-sm font-bold text-slate-800">Invite by email</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
          </select>
          <button
            type="button"
            disabled={!email.trim() || invite.isPending}
            onClick={() => invite.mutate()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create invite
          </button>
        </div>
        {invite.isError && <p className="mt-2 text-sm text-rose-700">{(invite.error as Error).message}</p>}
        {lastAcceptUrl && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
            <p className="font-semibold">Shareable accept link</p>
            <p className="mt-1 break-all font-mono text-[11px]">{lastAcceptUrl}</p>
            <button
              type="button"
              className="mt-2 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
              onClick={() => void copyText(lastAcceptUrl)}
            >
              Copy link
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          When SMTP is configured, an email is sent automatically. Until then, copy the link above (also logged on the API).
        </p>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800">Recent invitations</h2>
        {invQ.isLoading && <p className="mt-2 text-sm text-slate-600">Loading…</p>}
        <ul className="mt-2 space-y-2">
          {invQ.data?.invitations.map((i) => (
            <li
              key={i.id}
              className="rounded-xl border border-white/50 bg-white/55 px-3 py-2 text-sm shadow-sm backdrop-blur-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900">{i.email}</span>
                  <span className="text-slate-600"> — {i.membershipRole}</span>
                  {i.acceptedAt ? (
                    <span className="ml-2 text-xs text-emerald-700">Accepted</span>
                  ) : (
                    <span className="ml-2 text-xs text-amber-700">Pending · expires {new Date(i.expiresAt).toLocaleString()}</span>
                  )}
                </div>
                {!i.acceptedAt && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-200"
                      onClick={() => rotate.mutate(i.id)}
                      disabled={rotate.isPending}
                    >
                      New link
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100"
                      onClick={() => {
                        if (confirm('Revoke this pending invitation?')) revoke.mutate(i.id);
                      }}
                      disabled={revoke.isPending}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800">Employees</h2>
        {q.isLoading && <p className="mt-2 text-slate-600">Loading…</p>}
        {q.isError && <p className="mt-2 text-rose-700">Could not load employees.</p>}
        <ul className="mt-2 space-y-2">
          {q.data?.employees.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-white/50 bg-white/55 px-4 py-3 text-sm shadow-[var(--shadow-neu)] backdrop-blur-md"
            >
              <span className="font-semibold text-slate-900">
                {e.firstName} {e.lastName}
              </span>
              <span className="text-slate-600"> — {e.email}</span>
              {e.department && <span className="ml-2 text-xs text-slate-500">({e.department})</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
