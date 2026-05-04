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
                <Field
                  id="password"
                  name="password"
                  type="password"
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                />
                <ErrorMessage name="password" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
