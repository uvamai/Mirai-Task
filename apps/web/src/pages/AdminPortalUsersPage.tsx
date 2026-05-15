import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, Navigate } from 'react-router-dom';
import { delegateSuperAdmin, fetchAdminUsers, fetchSuperAdmins, revokeSuperAdmin, updateUserLoginStatus } from '../api/globalAdmin';

export function AdminPortalUsersPage() {
  const qc = useQueryClient();
  const { isGlobalAdmin } = useOutletContext<{ isGlobalAdmin?: boolean }>();
  const [query, setQuery] = useState('');
  const [isLoginActive, setIsLoginActive] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [delegateEmail, setDelegateEmail] = useState('');
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('query', query.trim());
    if (isLoginActive) p.set('isLoginActive', isLoginActive);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p;
  }, [query, isLoginActive, page, pageSize]);
  
  const q = useQuery({
    queryKey: ['admin-users', params.toString()],
    queryFn: () => fetchAdminUsers(params),
    enabled: isGlobalAdmin !== false,
  });
  
  const superAdminsQ = useQuery({
    queryKey: ['super-admins'],
    queryFn: fetchSuperAdmins,
    enabled: isGlobalAdmin !== false,
  });

  const mut = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      updateUserLoginStatus(userId, active),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const delegateMut = useMutation({
    mutationFn: (email: string) => delegateSuperAdmin(email),
    onSuccess: () => {
      setDelegateEmail('');
      void qc.invalidateQueries({ queryKey: ['super-admins'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeSuperAdmin(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['super-admins'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (isGlobalAdmin === false) {
    return <Navigate to="/app" replace />;
  }
  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.pageSize ?? pageSize)));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Global Users</h1>
      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search by email or name"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={isLoginActive}
          onChange={(e) => {
            setPage(1);
            setIsLoginActive(e.target.value);
          }}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={pageSize}
          onChange={(e) => {
            setPage(1);
            setPageSize(Number(e.target.value));
          }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
      {q.isLoading && <p className="text-sm text-slate-600">Loading users…</p>}
      {q.isError && <p className="text-sm text-rose-700">Could not load users.</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/40">
        <table className="min-w-full text-sm">
          <thead className="bg-white/50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Memberships</th>
              <th className="px-3 py-2">Login</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{u.email}</div>
                  <div className="text-xs text-slate-600">
                    {u.firstName} {u.lastName}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {(u.memberships ?? []).slice(0, 3).map((m) => (
                    <div key={`${u.id}-${m.tenantId}`} className="text-xs text-slate-700">
                      {m.tenantName} ({m.role})
                    </div>
                  ))}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      u.isLoginActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {u.isLoginActive ? 'Active' : 'Inactive'}
                  </span>
                  {u.isGlobalAdmin && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">Super Admin</span>}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-white/60"
                    onClick={() => mut.mutate({ userId: u.id, active: !u.isLoginActive })}
                    disabled={mut.isPending}
                  >
                    {u.isLoginActive ? 'Deactivate login' : 'Activate login'}
                  </button>
                </td>
              </tr>
            ))}
            {!q.isLoading && (q.data?.users?.length ?? 0) === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-600" colSpan={4}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {q.data?.page ?? page} of {totalPages} · {q.data?.total ?? 0} users
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-50"
            disabled={(q.data?.page ?? page) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-50"
            disabled={(q.data?.page ?? page) >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/40 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Super Admin Delegation</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="existing-user@example.com"
            value={delegateEmail}
            onChange={(e) => setDelegateEmail(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!delegateEmail.trim() || delegateMut.isPending}
            onClick={() => delegateMut.mutate(delegateEmail.trim())}
          >
            Delegate
          </button>
        </div>
        {superAdminsQ.isLoading && <p className="mt-2 text-sm text-slate-600">Loading super admins…</p>}
        {superAdminsQ.isError && <p className="mt-2 text-sm text-rose-700">Could not load super admins.</p>}
        <div className="mt-3 space-y-2">
          {(superAdminsQ.data?.superAdmins ?? []).map((sa) => (
            <div key={sa.userId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm">
              <div>
                <div className="font-semibold text-slate-900">{sa.email}</div>
                <div className="text-xs text-slate-600">
                  {sa.firstName} {sa.lastName}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                disabled={revokeMut.isPending}
                onClick={() => revokeMut.mutate(sa.userId)}
              >
                Revoke
              </button>
            </div>
          ))}
          {!superAdminsQ.isLoading && (superAdminsQ.data?.superAdmins?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-600">No super admins configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
