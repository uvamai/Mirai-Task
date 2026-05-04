import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContactSalesLead } from '../api/contactSales';

export function ContactSalesPage() {
  const [form, setForm] = useState({
    name: '',
    workEmail: '',
    company: '',
    teamSize: '',
    message: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    try {
      await submitContactSalesLead({
        name: form.name.trim(),
        workEmail: form.workEmail.trim(),
        company: form.company.trim(),
        teamSize: form.teamSize as '1-25' | '26-100' | '101-500' | '500+',
        message: form.message.trim(),
        source: 'web_contact_sales_form',
      });
      setStatus('Thanks — your request has been captured. Our team will contact you soon.');
      setForm({
        name: '',
        workEmail: '',
        company: '',
        teamSize: '',
        message: '',
      });
    } catch {
      setStatus('Could not submit right now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600/90">Enterprise</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Contact Sales</h1>
          <p className="mt-2 text-slate-600">
            Tell us about your environment and requirements. We will follow up with enterprise options.
          </p>
        </div>
        <Link
          to="/pricing"
          className="shrink-0 rounded-xl border border-white/50 bg-white/35 px-4 py-2 text-sm font-medium text-slate-800 shadow-[var(--shadow-neu)] backdrop-blur-md"
        >
          Back to pricing
        </Link>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-[var(--radius-glass)] border border-white/50 bg-white/35 p-6 shadow-[var(--shadow-neu)] backdrop-blur-xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input
              required
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
              placeholder="Jane Doe"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Work email
            <input
              required
              type="email"
              value={form.workEmail}
              onChange={(e) => updateField('workEmail', e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
              placeholder="jane@company.com"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Company
            <input
              required
              value={form.company}
              onChange={(e) => updateField('company', e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
              placeholder="Contoso"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Team size
            <select
              required
              value={form.teamSize}
              onChange={(e) => updateField('teamSize', e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
            >
              <option value="">Select one</option>
              <option value="1-25">1-25</option>
              <option value="26-100">26-100</option>
              <option value="101-500">101-500</option>
              <option value="500+">500+</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          What are you looking for?
          <textarea
            required
            value={form.message}
            onChange={(e) => updateField('message', e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
            placeholder="Security/compliance needs, expected user volume, integration requirements..."
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>

        {status && <p className="text-sm text-slate-700">{status}</p>}
      </form>
    </div>
  );
}
