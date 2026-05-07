import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

type IntakeConfig = {
  tenantName: string;
  projectName: string;
  requestTypes: { key: string; label: string; defaultPriority: string }[];
  /** When set, new tasks are filed on this board. */
  intakeBoardName?: string | null;
  captchaRequired: boolean;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void }) => string;
      remove?: (id: string) => void;
    };
  }
}

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export function PublicIntakePage() {
  const { tenantSlug, projectId } = useParams<{ tenantSlug: string; projectId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestTypeKey, setRequestTypeKey] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const cfgQ = useQuery({
    queryKey: ['intake-config', tenantSlug, projectId],
    enabled: Boolean(tenantSlug && projectId),
    queryFn: () =>
      publicJson<IntakeConfig>(
        `/public/intake/${encodeURIComponent(tenantSlug!)}/${encodeURIComponent(projectId!)}/config`
      ),
  });

  useEffect(() => {
    const cfg = cfgQ.data;
    if (!cfg?.captchaRequired || !siteKey || !widgetRef.current) return;
    const el = document.createElement('script');
    el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    el.async = true;
    el.onload = () => {
      if (!widgetRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (t) => setCaptchaToken(t),
        'error-callback': () => setCaptchaToken(''),
      });
    };
    document.body.appendChild(el);
    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [cfgQ.data, siteKey]);

  useEffect(() => {
    const types = cfgQ.data?.requestTypes ?? [];
    if (types.length && !requestTypeKey) setRequestTypeKey(types[0].key);
  }, [cfgQ.data, requestTypeKey]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!tenantSlug || !projectId) throw new Error('Missing route');
      return publicJson<{ ok: boolean; taskKey: string }>(
        `/public/intake/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            requestTypeKey,
            reporterEmail: reporterEmail.trim(),
            captchaToken: captchaToken || null,
          }),
        }
      );
    },
  });

  if (!tenantSlug || !projectId) return <p className="p-6 text-slate-600">Invalid link.</p>;

  if (cfgQ.isLoading) return <p className="p-6 text-slate-600">Loading…</p>;
  if (cfgQ.isError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-lg font-bold text-slate-900">Request unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{(cfgQ.error as Error).message}</p>
      </div>
    );
  }

  const cfg = cfgQ.data!;
  const needCaptcha = cfg.captchaRequired && !siteKey;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/60 bg-white/90 p-6 shadow-lg backdrop-blur-md">
        <h1 className="text-xl font-bold text-slate-900">{cfg.projectName}</h1>
        <p className="text-sm text-slate-500">{cfg.tenantName}</p>
        <p className="mt-3 text-xs text-slate-600">
          Submit a request or product feedback. You will not need to sign in.
          {cfg.intakeBoardName ? (
            <span className="mt-1 block text-slate-500">
              New items are filed on the board: <span className="font-semibold text-slate-700">{cfg.intakeBoardName}</span>
            </span>
          ) : null}
        </p>

        {submit.isSuccess && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            Thank you. Reference: <span className="font-mono">{submit.data.taskKey}</span>
          </p>
        )}

        {!submit.isSuccess && (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (cfg.captchaRequired && !captchaToken) return;
              submit.mutate();
            }}
          >
            <div>
              <label className="text-xs font-semibold text-slate-600">Request type</label>
              <select
                value={requestTypeKey}
                onChange={(e) => setRequestTypeKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {cfg.requestTypes.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Details</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Your email</label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            {cfg.captchaRequired && siteKey && <div ref={widgetRef} className="min-h-[65px]" />}
            {needCaptcha && (
              <p className="text-xs text-amber-800">
                Captcha is required for this form. Ask your administrator to set <code className="font-mono">VITE_TURNSTILE_SITE_KEY</code> in the web app build to match Cloudflare Turnstile.
              </p>
            )}
            {submit.isError && <p className="text-sm text-rose-700">{(submit.error as Error).message}</p>}
            <button
              type="submit"
              disabled={submit.isPending || needCaptcha || (cfg.captchaRequired && !captchaToken)}
              className="w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submit.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
