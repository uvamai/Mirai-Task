import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type LauncherItem = {
  to: string;
  label: string;
  hint: string;
  /** Single emoji or short glyph */
  icon: string;
  adminOnly?: boolean;
};

const ITEMS: LauncherItem[] = [
  { to: '/app/my-work', label: 'My work', hint: 'Tasks assigned to you', icon: '◎' },
  { to: '/app', label: 'Projects', hint: 'All projects & boards', icon: '▦' },
  { to: '/app/employees', label: 'Team', hint: 'Invites & directory', icon: '◎' },
  { to: '/app/billing', label: 'Billing', hint: 'Plan & usage', icon: '◇' },
  { to: '/app/profile', label: 'Profile', hint: 'Account & notifications', icon: '◉' },
  { to: '/app/org-settings', label: 'Organization', hint: 'Policies & defaults', icon: '⚙', adminOnly: true },
  { to: '/app/admin-portal/dashboard', label: 'Admin', hint: 'Tenant admin portal', icon: 'A', adminOnly: true },
];

export function AppLauncherModal({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const visible = ITEMS.filter((i) => !i.adminOnly || isAdmin);

  /** Portal: `fixed` inside `backdrop-filter` (e.g. glass sidebar) is viewport-relative only when attached to `body`. */
  const node = (
    <>
      <div className="fixed inset-0 z-[140] bg-slate-900/40 backdrop-blur-sm" role="presentation" onMouseDown={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Apps and navigation"
        tabIndex={-1}
        className="fixed left-1/2 top-[10vh] z-[150] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2"
      >
        <div className="glass-modal-card rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Apps</h2>
              <p className="mt-0.5 text-xs text-slate-600">Quick links across workspace tools.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Esc
            </button>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  className="flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-white/90 p-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  <span className="text-lg" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="text-[11px] leading-snug text-slate-500">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
