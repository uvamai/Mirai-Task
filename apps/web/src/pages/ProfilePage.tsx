import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '../api/client';

/** IANA zones for quiet-hours interpretation (extend as needed). */
const QUIET_HOUR_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

type Me = {
  user: { email: string; firstName: string; lastName: string };
  tenant: { name: string; slug: string } | null;
  membership: { role: string };
  subscription: { planCode?: string; status: string } | null;
  preferences?: Record<string, unknown>;
};

export function ProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => apiJson<Me>('/auth/me'),
  });
  const [workspaceNotes, setWorkspaceNotes] = useState('');
  const [dueReminders, setDueReminders] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [quietTz, setQuietTz] = useState('');

  useEffect(() => {
    const p = q.data?.preferences ?? {};
    const n = p.workspaceNotes;
    setWorkspaceNotes(typeof n === 'string' ? n : '');
    const not = p.notifications as Record<string, unknown> | undefined;
    setDueReminders(not?.dueReminders !== false);
    setMentions(not?.mentions !== false);
    setQuietStart(typeof not?.quietHoursStart === 'string' ? not.quietHoursStart : '');
    setQuietEnd(typeof not?.quietHoursEnd === 'string' ? not.quietHoursEnd : '');
    setQuietTz(typeof not?.quietHoursTimezone === 'string' ? not.quietHoursTimezone : '');
  }, [q.data?.preferences]);

  const savePrefs = useMutation({
    mutationFn: async () => {
      const prev = q.data?.preferences ?? {};
      const res = await apiFetch('/auth/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            ...prev,
            workspaceNotes: workspaceNotes.trim() || null,
            notifications: {
              dueReminders,
              mentions,
              quietHoursStart: quietStart.trim() || null,
              quietHoursEnd: quietEnd.trim() || null,
              quietHoursTimezone: quietTz.trim() || null,
            },
          },
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me-profile'] }),
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
      {q.isLoading && <p className="text-slate-600">Loading…</p>}
      {q.data && (
        <div className="rounded-2xl border border-white/50 bg-white/55 p-6 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              {q.data.user.firstName} {q.data.user.lastName}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">{q.data.user.email}</p>
          <p className="mt-4 text-sm text-slate-700">
            Role: <span className="font-semibold">{q.data.membership.role}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Tenant: <span className="font-semibold">{q.data.tenant?.name}</span>
          </p>
          {q.data.tenant?.slug && (
            <p className="mt-1 text-sm text-slate-600">
              Tenant slug (for public intake URLs):{' '}
              <span className="font-mono font-semibold text-slate-900">{q.data.tenant.slug}</span>
            </p>
          )}
          {q.data.subscription && (
            <p className="mt-1 text-sm text-slate-700">
              Plan:{' '}
              <span className="font-semibold">
                {q.data.subscription.planCode} ({q.data.subscription.status})
              </span>
            </p>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h2 className="text-xs font-bold uppercase text-slate-600">Preferences</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Stored on your membership (per tenant). Other keys can be merged via the same API.
            </p>
            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-xs font-bold uppercase text-slate-600">Notifications</p>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={dueReminders} onChange={(e) => setDueReminders(e.target.checked)} />
                Due date reminders (in-app)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={mentions} onChange={(e) => setMentions(e.target.checked)} />
                @mention alerts in comments
              </label>
              <p className="text-[10px] text-slate-500">
                Quiet hours suppress in-app due reminders, SLA alerts, and @mention notifications during the window. Times
                are interpreted in the timezone below; leave empty for UTC.
              </p>
              <label className="mt-1 block text-xs text-slate-600">
                Quiet hours timezone
                <select
                  value={quietTz}
                  onChange={(e) => setQuietTz(e.target.value)}
                  className="mt-0.5 block w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">UTC (default)</option>
                  {QUIET_HOUR_TIMEZONES.filter((z) => z !== 'UTC').map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="text-xs text-slate-600">
                  Quiet start
                  <input
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Quiet end
                  <input
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>

            <label className="mt-3 block text-xs font-semibold text-slate-600">Workspace notes</label>
            <textarea
              value={workspaceNotes}
              onChange={(e) => setWorkspaceNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Private reminders, saved view hints, etc."
            />
            {savePrefs.isError && <p className="mt-1 text-xs text-rose-700">{(savePrefs.error as Error).message}</p>}
            {savePrefs.isSuccess && <p className="mt-1 text-xs text-emerald-800">Saved.</p>}
            <button
              type="button"
              disabled={savePrefs.isPending}
              className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => savePrefs.mutate()}
            >
              {savePrefs.isPending ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
