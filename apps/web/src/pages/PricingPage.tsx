import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { fetchPublicPlans } from '../api/plans';
import { planAvailabilityNotice, planMatrix } from '../content/pricingMatrix';

export function PricingPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPublicPlans,
  });
  const limitByCode = new Map((data ?? []).map((p) => [p.code.toLowerCase(), p]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600/90">Pricing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Subscription plans</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Compare features and pricing for Starter, Standard, Pro, and Enterprise. AI/automation board features
            require Enterprise with an active subscription.
          </p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded-xl border border-white/50 bg-white/35 px-4 py-2 text-sm font-medium text-slate-800 shadow-[var(--shadow-neu)] backdrop-blur-md"
        >
          Back home
        </Link>
      </div>

      {isLoading && <p className="text-slate-600">Loading plans…</p>}
      {isError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Could not load plans. Is the API running on port 4000?
        </p>
      )}

      <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {planAvailabilityNotice}
      </p>

      <section className="mb-8 rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm backdrop-blur-md">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600/90">
          Excel/CSV import (every plan)
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Drop a spreadsheet into any project to create a new board with your columns mapped to status,
          priority, assignees, due dates, tags, and custom fields. Imported boards count toward your
          per-project board limit on every plan.
        </p>
        <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-4">
          <div className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Starter</p>
            <p>200 rows · 2 imports / hour</p>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Standard</p>
            <p>5,000 rows · 10 imports / hour</p>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Pro</p>
            <p>50,000 rows · 30 imports / hour</p>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Enterprise</p>
            <p>Unlimited (contractual)</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {planMatrix.map((plan, i) => {
          const publicPlan = limitByCode.get(plan.code);
          return (
          <motion.article
            key={plan.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex flex-col rounded-[var(--radius-glass)] border border-white/50 bg-white/35 p-6 shadow-[var(--shadow-neu)] backdrop-blur-xl"
          >
            <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
            <p className="mt-6 text-3xl font-bold text-slate-900">{plan.headlinePrice}</p>
            {plan.subPrice && <p className="text-sm text-slate-500">{plan.subPrice}</p>}
            <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
              {publicPlan && (
                <>
                  <li className="pt-2 text-slate-500">Public API limits:</li>
                  <li>- Up to {publicPlan.maxProjects} projects</li>
                  <li>- Up to {publicPlan.maxSeats} seats</li>
                </>
              )}
            </ul>
            {plan.ctaDisabled ? (
              <button
                type="button"
                disabled
                className="mt-8 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-500"
              >
                {plan.ctaLabel}
              </button>
            ) : plan.ctaHref?.startsWith('mailto:') ? (
              <a
                href={plan.ctaHref}
                className="mt-8 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
              >
                {plan.ctaLabel}
              </a>
            ) : (
              <Link
                to={plan.ctaHref ?? '/register'}
                className="mt-8 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
              >
                {plan.ctaLabel}
              </Link>
            )}
            {plan.ctaHint && <p className="mt-2 text-xs text-slate-500">{plan.ctaHint}</p>}
          </motion.article>
          );
        })}
      </div>
    </div>
  );
}
