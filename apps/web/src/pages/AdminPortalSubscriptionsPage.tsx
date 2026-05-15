import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, Navigate } from 'react-router-dom';
import { fetchAdminSubscriptions, updateSubscription } from '../api/globalAdmin';

export function AdminPortalSubscriptionsPage() {
  const qc = useQueryClient();
  const { isGlobalAdmin } = useOutletContext<{ isGlobalAdmin?: boolean }>();
  const [tenantQuery, setTenantQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (tenantQuery.trim()) p.set('tenantQuery', tenantQuery.trim());
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p;
  }, [tenantQuery, page, pageSize]);
  
  const q = useQuery({
    queryKey: ['admin-subs', params.toString()],
    queryFn: () => fetchAdminSubscriptions(params),
    enabled: isGlobalAdmin !== false,
  });

  const mut = useMutation({
    mutationFn: ({ tenantId, payload }: { tenantId: string; payload: { status?: string; planCode?: string; extendDays?: number } }) =>
      updateSubscription(tenantId, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-subs'] }),
  });

  if (isGlobalAdmin === false) {
    return <Navigate to="/app" replace />;
  }
  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.pageSize ?? pageSize)));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Global Subscriptions</h1>
      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search tenant by name or slug"
          value={tenantQuery}
          onChange={(e) => {
            setPage(1);
            setTenantQuery(e.target.value);
          }}
        />
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
        <button
          type="button"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-white/60"
          onClick={() => {
            const qs = new URLSearchParams({
              actionPrefix: 'global_admin.',
              from: new Date(Date.now() - 30 * 86400_000).toISOString(),
              to: new Date().toISOString(),
            });
            window.open(`/api/global-admin/audit/export?${qs.toString()}`, '_blank');
          }}
        >
          Export admin audit
        </button>
      </div>
      {q.isLoading && <p className="text-sm text-slate-600">Loading subscriptions…</p>}
      {q.isError && <p className="text-sm text-rose-700">Could not load subscriptions.</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/40">
        <table className="min-w-full text-sm">
          <thead className="bg-white/50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Period end</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.subscriptions ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{s.tenantName}</div>
                  <div className="text-xs text-slate-600">{s.tenantSlug}</div>
                </td>
                <td className="px-3 py-2">{s.planDisplayName ?? s.planCode ?? '-'}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-white/60"
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ tenantId: s.tenantId, payload: { status: 'active' } })}
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-white/60"
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ tenantId: s.tenantId, payload: { status: 'canceled' } })}
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-white/60"
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ tenantId: s.tenantId, payload: { extendDays: 30 } })}
                    >
                      +30d
                    </button>
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        const code = e.target.value;
                        if (!code) return;
                        mut.mutate({ tenantId: s.tenantId, payload: { planCode: code } });
                        e.currentTarget.value = '';
                      }}
                    >
                      <option value="">Change plan…</option>
                      <option value="starter">Starter</option>
                      <option value="standard">Standard</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {!q.isLoading && (q.data?.subscriptions?.length ?? 0) === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-600" colSpan={5}>
                  No subscriptions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {q.data?.page ?? page} of {totalPages} · {q.data?.total ?? 0} subscriptions
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
    </div>
  );
}
