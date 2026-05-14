import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../hooks';
import { setSession } from '../features/auth/authSlice';

const schema = Yup.object({
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string()
    .min(12, 'At least 12 characters')
    .matches(/[a-z]/, 'Need lowercase')
    .matches(/[A-Z]/, 'Need uppercase')
    .matches(/[0-9]/, 'Need digit')
    .matches(/[^A-Za-z0-9]/, 'Need special character')
    .required('Required'),
  firstName: Yup.string().max(120).required('Required'),
  lastName: Yup.string().max(120).required('Required'),
  organizationName: Yup.string().max(255).required('Required'),
});

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planHint = params.get('plan');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-[var(--radius-glass)] border border-white/50 bg-white/40 p-8 shadow-[var(--shadow-neu)] backdrop-blur-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Create workspace</h1>
        {planHint && (
          <p className="mt-2 text-sm text-slate-600">
            Plan hint: <span className="font-semibold">{planHint}</span> — new workspaces start on Starter; upgrade from Billing after signup.
          </p>
        )}
        <Formik
          initialValues={{
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            organizationName: '',
          }}
          validationSchema={schema}
          onSubmit={async (values, { setStatus }) => {
            setStatus(undefined);
            const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus(body.error ?? 'Registration failed');
              return;
            }
            dispatch(
              setSession({
                accessToken: body.accessToken,
                tenantId: body.tenant?.id,
                refreshToken: body.refreshToken,
              })
            );
            navigate('/app', { replace: true });
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="firstName">
                    First name
                  </label>
                  <Field
                    id="firstName"
                    name="firstName"
                    className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                  />
                  <ErrorMessage name="firstName" component="p" className="mt-1 text-xs text-rose-600" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="lastName">
                    Last name
                  </label>
                  <Field
                    id="lastName"
                    name="lastName"
                    className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                  />
                  <ErrorMessage name="lastName" component="p" className="mt-1 text-xs text-rose-600" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600" htmlFor="organizationName">
                  Organization
                </label>
                <Field
                  id="organizationName"
                  name="organizationName"
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                />
                <ErrorMessage name="organizationName" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              {status && <p className="text-sm text-rose-700">{status}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              >
                {isSubmitting ? 'Creating…' : 'Create tenant & admin'}
              </button>
            </Form>
          )}
        </Formik>
        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-indigo-700" to="/login">
            Sign in
          </Link>
          {' · '}
          <Link className="font-semibold text-indigo-700" to="/">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
