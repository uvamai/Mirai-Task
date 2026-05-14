import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, apiJson } from '../api/client';

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
  const [showPassword, setShowPassword] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const nextLogin = useMemo(
    () => `/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`,
    [token]
  );

  useEffect(() => {
    if (isSignedIn) {
      apiJson<{ user: { email: string } }>('/auth/me')
        .then((res) => setSignedInEmail(res.user.email))
        .catch(() => null);
    }
  }, [isSignedIn]);

  function handleSignOut() {
    localStorage.removeItem('mirai_access_token');
    localStorage.removeItem('mirai_refresh_token');
    window.location.reload();
  }

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
          {isSignedIn ? (
            <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 shadow-sm backdrop-blur-sm mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Account</p>
              <p className="mt-1 font-medium text-slate-900">
                Signed in as: <span className="font-bold text-indigo-600">{signedInEmail || 'Loading account…'}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Confirm this is the correct account that received the invitation. Click <strong>Accept</strong> below to join the organization.
              </p>
              <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">Not your account?</span>{' '}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="font-semibold text-rose-600 hover:text-rose-700 hover:underline focus:outline-none"
                >
                  Sign out & switch accounts
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600">Invited email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Password (new accounts only)</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-800 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
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
