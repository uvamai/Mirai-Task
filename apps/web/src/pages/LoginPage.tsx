import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks';
import { setSession } from '../features/auth/authSlice';

const schema = Yup.object({
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().required('Required'),
});

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPathRaw = params.get('next');
  const nextPath = nextPathRaw && nextPathRaw.startsWith('/') ? nextPathRaw : null;
  /** Pick workspace when the account has multiple tenants (must match a membership). */
  const tenantIdFromUrl = params.get('tenantId') ?? params.get('tenant');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-[var(--radius-glass)] border border-white/50 bg-white/40 p-8 shadow-[var(--shadow-neu)] backdrop-blur-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={schema}
          onSubmit={async (values, { setStatus }) => {
            setStatus(undefined);
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...values,
                ...(tenantIdFromUrl ? { tenantId: tenantIdFromUrl } : {}),
              }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus(body.error ?? 'Login failed');
              return;
            }
            dispatch(
              setSession({
                accessToken: body.accessToken,
                tenantId: body.tenantId,
                refreshToken: body.refreshToken,
              })
            );
            navigate(nextPath || '/app');
          }}
        >
          {({ isSubmitting, status }) => (
            <Form className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600" htmlFor="email">
                  Email
                </label>
                <Field
                  id="email"
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                />
                <ErrorMessage name="email" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600" htmlFor="password">
                  Password
                </label>
                <div className="relative mt-1">
                  <Field
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-white/60 bg-white/70 pl-3 pr-10 py-2 text-sm shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-800 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                <ErrorMessage name="password" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              {status && <p className="text-sm text-rose-700">{status}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </Form>
          )}
        </Formik>
        <p className="mt-4 text-center text-sm text-slate-600">
          New here?{' '}
          <Link className="font-semibold text-indigo-700" to="/register">
            Create workspace
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link className="text-slate-500 hover:text-slate-800" to="/">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
