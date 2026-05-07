import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { planAvailabilityNotice, planMatrix } from '../content/pricingMatrix';

export function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
      <header className="mb-16 flex items-center justify-between">
        <div className="rounded-2xl border border-white/40 bg-white/35 px-5 py-2 text-sm font-semibold tracking-wide text-slate-800 shadow-[var(--shadow-neu)] backdrop-blur-xl">
          MIRAI Tasker
        </div>
        <nav className="flex gap-4 text-sm font-medium text-slate-700">
          <Link className="rounded-lg px-3 py-2 hover:bg-white/40" to="/pricing">
            Pricing
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-white/40" to="/login">
            Sign in
          </Link>
          <Link
            className="rounded-lg bg-slate-900/90 px-4 py-2 text-white shadow-lg shadow-slate-900/20"
            to="/register"
          >
            Start trial
          </Link>
        </nav>
      </header>

      <main className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600/90">
            Multi-tenant SaaS
          </p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            SLA-aware Kanban for teams that need audit-ready delivery.
          </h1>
          <p className="max-w-xl text-lg text-slate-600">
            Per-tenant subscriptions and project limits. The dedicated AI/automation board, agent handoffs, and
            approval-gated execution are{' '}
            <span className="font-semibold text-slate-800">Enterprise-only on an active subscription</span>—with
            local-first development and production parity.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/register"
              className="rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 px-8 py-3 text-center text-sm font-semibold text-white shadow-xl shadow-indigo-500/30"
            >
              Create your workspace
            </Link>
            <Link
              to="/pricing"
              className="rounded-2xl border border-white/50 bg-white/30 px-8 py-3 text-center text-sm font-semibold text-slate-800 shadow-[var(--shadow-neu)] backdrop-blur-md"
            >
              View plans
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="rounded-[var(--radius-glass)] border border-white/45 bg-white/25 p-8 shadow-[var(--shadow-neu)] backdrop-blur-2xl"
        >
          <h2 className="text-lg font-semibold text-slate-900">Why MIRAI Tasker</h2>
          <ul className="mt-6 space-y-4 text-slate-700">
            {[
              'Tenant isolation with subscription enforcement',
              'Enterprise subscription unlocks the automation board, agent queue, and governed execution (roadmap)',
              'Immutable audit trail and APIs designed for agent integrations',
              'Glass + neumorphic UI system for consistent polish',
            ].map((item) => (
              <li
                key={item}
                className="rounded-2xl bg-white/40 px-4 py-3 text-sm shadow-[var(--shadow-neu-inset)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </main>

      <section className="mt-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600/90">Subscriptions</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Pick the plan that fits your team</h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            Starter is free forever. Standard and Pro pricing are published below, and checkout for those tiers will
            be enabled once payments go live. Pro includes schedule-based recurring tasks and SLA tooling—not the
            Enterprise AI automation board.
          </p>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {planAvailabilityNotice}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {planMatrix.map((plan) => (
            <article
              key={plan.code}
              className="flex h-full flex-col rounded-[var(--radius-glass)] border border-white/50 bg-white/35 p-6 shadow-[var(--shadow-neu)] backdrop-blur-xl"
            >
              <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-4 text-2xl font-bold text-slate-900">{plan.headlinePrice}</p>
              {plan.subPrice && <p className="text-sm text-slate-500">{plan.subPrice}</p>}
              <p className="mt-3 text-sm text-slate-600">{plan.description}</p>

              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                {plan.features.map((f) => (
                  <li key={f}>- {f}</li>
                ))}
              </ul>

              {plan.ctaDisabled ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  {plan.ctaLabel}
                </button>
              ) : plan.ctaHref?.startsWith('mailto:') ? (
                <a
                  href={plan.ctaHref}
                  className="mt-6 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
                >
                  {plan.ctaLabel}
                </a>
              ) : (
                <Link
                  to={plan.ctaHref ?? '/pricing'}
                  className="mt-6 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
                >
                  {plan.ctaLabel}
                </Link>
              )}
              {plan.ctaHint && <p className="mt-2 text-xs text-slate-500">{plan.ctaHint}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
