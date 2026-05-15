import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiJson, apiFetch } from '../api/client';

type FormConfig = {
  id: string;
  title: string;
  description: string;
  fields: {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select';
    required: boolean;
    options?: string[];
  }[];
  projectName: string;
  tenantName: string;
};

export function PublicCustomFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);

  const formQ = useQuery({
    queryKey: ['public-form', formId],
    enabled: Boolean(formId),
    queryFn: () => apiJson<FormConfig>(`/public/forms/${formId}`),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/public/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporterEmail: email, values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      return data as { taskKey: string };
    },
    onSuccess: (data) => {
      setSubmittedKey(data.taskKey);
    },
  });

  if (formQ.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading form...</div>;
  if (formQ.isError || !formQ.data) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-rose-600 font-bold">Form not found or inactive.</div>;

  const form = formQ.data;

  if (submittedKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-3xl border border-white bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-slate-900">Submission Received</h2>
          <p className="mt-2 text-slate-600">Your request has been logged as <span className="font-bold text-indigo-600">{submittedKey}</span>.</p>
          <button
             onClick={() => { setSubmittedKey(null); setValues({}); setEmail(''); }}
             className="mt-8 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white bg-white/70 shadow-2xl backdrop-blur-2xl">
        <div className="bg-slate-900 p-8 text-white">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {form.tenantName} / {form.projectName}
          </div>
          <h1 className="mt-2 text-3xl font-bold">{form.title}</h1>
          <p className="mt-2 text-sm text-slate-300">{form.description}</p>
        </div>

        <form 
          className="p-8 space-y-6"
          onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }}
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Your Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="name@company.com"
            />
          </div>

          <div className="h-px bg-slate-100 my-8" />

          {form.fields.map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  value={values[field.label] || ''}
                  onChange={(e) => setValues({ ...values, [field.label]: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  rows={4}
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={values[field.label] || ''}
                  onChange={(e) => setValues({ ...values, [field.label]: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select an option...</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required={field.required}
                  value={values[field.label] || ''}
                  onChange={(e) => setValues({ ...values, [field.label]: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>
          ))}

          {submitMutation.isError && (
            <p className="text-sm font-bold text-rose-600">{(submitMutation.error as Error).message}</p>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="mt-8 w-full rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
