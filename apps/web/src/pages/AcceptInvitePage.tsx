import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

export function AcceptInvitePage() {
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [invitedEmailMasked, setInvitedEmailMasked] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignedIn = Boolean(localStorage.getItem('mirai_access_token'));
  const nextLogin = useMemo(
    () => `/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`,
    [token]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!token) return;
      try {
        const res = await fetch(`/api/public/invitations/preview?token=${encodeURIComponent(token)}`);
        const body = (await res.json().catch(() => ({}))) as {
          tenantName?: string;
          invitedEmailMasked?: string;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setStatus(body.error ?? 'Invalid or expired invitation');
          }
          return;
        }
        if (!cancelled) {
          setTenantName(body.tenantName ?? null);
          setInvitedEmailMasked(body.invitedEmailMasked ?? null);
        }
      } catch {
        if (!cancelled) setStatus('Could not load invitation details');
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    setStatusCode(null);
    try {
      const accessToken = localStorage.getItem('mirai_access_token');
      const isSignedIn = Boolean(accessToken);
      const res = isSignedIn
        ? await apiFetch('/invitations/accept-authenticated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
        : await fetch('/api/public/invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, email, password, firstName, lastName }),
          });
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setStatus(body.error ?? 'Request failed');
        setStatusCode(body.code ?? null);
        return;
      }
      setStatus('ok');
    } catch {
      setStatus('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Accept invitation</h1>
      {!token && <p className="text-sm text-rose-700">Missing token in URL.</p>}
      {tenantName && (
        <p className="text-sm text-slate-600">
          Invitation to join <span className="font-semibold text-slate-900">{tenantName}</span>
          {invitedEmailMasked && (
            <>
              {' '}
              as <span className="font-semibold text-slate-900">{invitedEmailMasked}</span>
            </>
          )}
          .
        </p>
      )}
      {status === 'ok' ? (
        <p className="text-sm text-emerald-800">
          You have joined the organization.{' '}
          <Link to="/login" className="font-semibold text-indigo-700 underline">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Invited email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          {isSignedIn ? (
            <p className="text-sm text-slate-600">
              You are signed in. Confirm the invited email above, then click <span className="font-semibold">Accept</span>{' '}
              to join this organization.
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Password (new accounts only)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  If you already have an account with this email, sign in first.
                </p>
              </div>
            </>
          )}
          {status && <p className="text-sm text-rose-700">{status}</p>}
          {statusCode === 'SIGN_IN_REQUIRED' && (
            <p className="text-sm text-slate-700">
              This email already has an account.{' '}
              <Link className="font-semibold text-indigo-700 underline" to={nextLogin}>
                Sign in to continue
              </Link>
              .
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !token}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Accept'}
          </button>
        </form>
      )}
    </div>
  );
}
