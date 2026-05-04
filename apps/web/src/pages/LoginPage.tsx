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
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPathRaw = params.get('next');
  const nextPath = nextPathRaw && nextPathRaw.startsWith('/') ? nextPathRaw : null;

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
              body: JSON.stringify(values),
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
                <Field
                  id="password"
                  name="password"
                  type="password"
                  className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm shadow-inner"
                />
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
