import { Link } from 'react-router-dom';

export function PlanLimitModal({
  open,
  message,
  title = 'Plan limit',
  action = { to: '/app/billing', label: 'Billing & usage' },
  onClose,
}: {
  open: boolean;
  message: string;
  title?: string;
  action?: { to: string; label: string };
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <div className="mt-6 flex gap-3">
          <Link
            to={action.to}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center text-sm font-semibold text-white"
            onClick={onClose}
          >
            {action.label}
          </Link>
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
