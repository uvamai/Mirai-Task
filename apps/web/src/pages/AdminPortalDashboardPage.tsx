import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboard } from '../api/globalAdmin';

export function AdminPortalDashboardPage() {
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchAdminDashboard });

  if (q.isLoading) return <p className="text-sm text-slate-600">Loading admin dashboard…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-rose-700">Could not load admin dashboard.</p>;

  const cards = [
    { label: 'Tenants', value: q.data.totals.tenants },
    { label: 'Users', value: q.data.totals.users },
    { label: 'Active Logins', value: q.data.totals.usersLoginActive },
    { label: 'Active/Trialing Subs', value: q.data.totals.subscriptionsActiveOrTrialing },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Global Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/50 bg-white/40 p-4 shadow-[var(--shadow-neu)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
