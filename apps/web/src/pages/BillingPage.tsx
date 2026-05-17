import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams, useOutletContext, Navigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api/client';

type BillingResponse = {
  billingMode: string;
  tenant: { id: string; name: string; status: string } | null;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  plan: {
    code: string;
    displayName: string;
    maxProjects: number;
    maxSeats: number;
  } | null;
  usage: { projectCount: number; seatCount: number };
};

export function BillingPage() {
  const [params] = useSearchParams();
  const checkoutOk = params.get('checkout') === 'success';
  const { isAdmin, tenantId } = useOutletContext<{ isAdmin?: boolean; tenantId?: string }>();

  const q = useQuery({
    queryKey: ['billing', tenantId],
    enabled: Boolean(tenantId && isAdmin),
    queryFn: () => apiJson<BillingResponse>(`/tenants/${tenantId}/billing`),
  });

  const checkout = useMutation({
    mutationFn: async (planCode: string) => {
      const res = await apiFetch(`/tenants/${tenantId}/billing/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Checkout failed');
      return body as { url: string | null };
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/tenants/${tenantId}/billing/portal-session`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Portal failed');
      return body as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  // Force-redirect non-admins away from billing page
  if (isAdmin === false) {
    return <Navigate to="/app" replace />;
  }

  if (!tenantId) return <p className="text-slate-600">No tenant context</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Billing & usage</h1>
      {checkoutOk && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Checkout completed — refresh below if subscription has not updated yet.
        </p>
      )}
      {q.isLoading && <p className="text-slate-600">Loading…</p>}
      {q.isError && <p className="text-rose-700">Could not load billing.</p>}
      {q.data && (
        <div className="space-y-4 rounded-2xl border border-white/50 bg-white/55 p-6 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <p className="text-sm text-slate-600">
            Mode: <span className="font-semibold text-slate-900">{q.data.billingMode}</span>
          </p>
          {q.data.plan && (
            <div className="text-sm text-slate-700">
              <p>
                Plan:{' '}
                <span className="font-semibold">
                  {q.data.plan.displayName} ({q.data.plan.code})
                </span>
              </p>
              <p>
                Limits: {q.data.plan.maxProjects} projects, {q.data.plan.maxSeats} seats
              </p>
            </div>
          )}
          <p className="text-sm text-slate-700">
            Usage: {q.data.usage.projectCount} projects, {q.data.usage.seatCount} seats
          </p>
          {q.data.subscription && (
            <p className="text-sm text-slate-700">
              Subscription: <span className="font-semibold">{q.data.subscription.status}</span>
            </p>
          )}
          {q.data.billingMode === 'stripe' ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate('pro')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Upgrade (Pro) via Stripe
              </button>
              <button
                type="button"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                Customer portal
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Mock billing is active. Set <code className="rounded bg-slate-100 px-1">BILLING_MODE=stripe</code> and
              Stripe keys to enable Checkout and the customer portal.
            </p>
          )}
          {checkout.isError && (
            <p className="text-sm text-rose-700">{(checkout.error as Error).message}</p>
          )}
          {portal.isError && <p className="text-sm text-rose-700">{(portal.error as Error).message}</p>}
        </div>
      )}
    </div>
  );
}
