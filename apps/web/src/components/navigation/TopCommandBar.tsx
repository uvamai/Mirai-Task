import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

export type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export function TopCommandBar({
  tenantName,
  unread,
  notifications,
  notifOpen,
  setNotifOpen,
  onMarkAllRead,
  onMarkRead,
  onOpenPalette,
  onLogout,
}: {
  tenantName: string;
  unread: number;
  notifications: NotifRow[];
  notifOpen: boolean;
  setNotifOpen: (v: boolean) => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenPalette: () => void;
  onLogout: () => void;
}) {
  const notifRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen, setNotifOpen]);

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">MIRAI Tasker</div>
            <div className="truncate text-[11px] font-medium text-slate-500">{tenantName}</div>
          </div>
          <div className="hidden min-w-[420px] max-w-[720px] flex-1 lg:block">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (coming soon)…"
              className="w-full rounded-full border border-white/70 bg-white/55 px-4 py-2 text-sm shadow-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/app"
            className="hidden rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white lg:inline-flex"
          >
            Home
          </Link>
          <button
            type="button"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 active:scale-[0.99]"
            onClick={() => {
              onOpenPalette();
            }}
          >
            Ctrl+K
          </button>
          <Link
            to="/pricing"
            className="hidden rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 lg:inline-flex"
          >
            Upgrade
          </Link>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative rounded-full border border-white/70 bg-white/55 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/70"
              aria-expanded={notifOpen}
              aria-haspopup="true"
              aria-label="Notifications"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              🔔
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-bold uppercase text-slate-600">Notifications</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                    onClick={onMarkAllRead}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 && <p className="p-3 text-xs text-slate-600">No notifications yet.</p>}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`border-b border-slate-50 px-3 py-2 text-xs ${n.readAt ? 'opacity-70' : 'bg-indigo-50/40'}`}
                    >
                      <div className="font-semibold text-slate-900">{n.title}</div>
                      {n.body && <p className="mt-0.5 text-slate-600">{n.body}</p>}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                        {!n.readAt && (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-indigo-700 hover:underline"
                            onClick={() => onMarkRead(n.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white" to="/app/profile">
            Profile
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

