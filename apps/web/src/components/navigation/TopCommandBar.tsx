import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  Search, Bell, Plus, CircleUserRound, LogOut,
  AlertTriangle, Info, CheckCircle2, MessageSquare, AtSign,
} from 'lucide-react';

export type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

function notifIcon(type: string) {
  if (type.includes('mention')) return <AtSign size={14} className="text-indigo-500" />;
  if (type.includes('overdue') || type.includes('sla') || type.includes('breach'))
    return <AlertTriangle size={14} className="text-rose-500" />;
  if (type.includes('comment')) return <MessageSquare size={14} className="text-blue-500" />;
  if (type.includes('assign') || type.includes('reassign'))
    return <Info size={14} className="text-amber-500" />;
  if (type.includes('done') || type.includes('complete'))
    return <CheckCircle2 size={14} className="text-emerald-500" />;
  return <Info size={14} className="text-slate-400" />;
}

function notifBg(type: string, readAt: string | null) {
  if (readAt) return '';
  if (type.includes('overdue') || type.includes('sla') || type.includes('breach')) return 'bg-rose-50/60';
  if (type.includes('mention')) return 'bg-indigo-50/60';
  if (type.includes('comment')) return 'bg-blue-50/40';
  return 'bg-amber-50/40';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TopCommandBar({
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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen, setNotifOpen]);

  return (
    <header className="sticky top-0 z-30 glass-header border-b border-slate-200">
      <div className="flex h-12 items-center justify-between px-4">
        {/* Left: breadcrumb placeholder */}
        <div className="flex-1 flex items-center" />

        {/* Center: Global Search */}
        <div className="flex-1 flex justify-center max-w-2xl">
          <button
            onClick={onOpenPalette}
            className="group flex w-full max-w-[480px] items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-all border border-transparent hover:border-indigo-200"
          >
            <Search size={15} className="shrink-0" />
            <span className="flex-1 text-left text-[13px]">Search or jump to…</span>
            <span className="rounded-lg bg-white px-1.5 py-0.5 text-[10px] font-bold shadow-sm border border-slate-200 text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-500 transition">
              ⌘K
            </span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex-1 flex justify-end items-center gap-1">

          {/* Quick-create */}
          <button
            onClick={onOpenPalette}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 transition shadow-sm"
            title="New task (Ctrl+K)"
          >
            <Plus size={14} /> New
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1.5" />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              aria-expanded={notifOpen}
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <Bell size={17} />
              {unread > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white"
                  style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-800">Notifications</span>
                    {unread > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{unread} new</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                    onClick={onMarkAllRead}
                  >
                    Mark all read
                  </button>
                </div>

                {/* List */}
                <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                  {notifications.length === 0 && (
                    <div className="flex flex-col items-center py-10 text-center">
                      <CheckCircle2 size={32} className="text-emerald-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-500">All caught up!</p>
                      <p className="text-xs text-slate-400">No notifications yet.</p>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 transition hover:bg-slate-50 ${notifBg(n.type, n.readAt)} ${n.readAt ? 'opacity-60' : ''}`}
                    >
                      <div className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm">
                        {notifIcon(n.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-400">{timeAgo(n.createdAt)}</span>
                          {!n.readAt && (
                            <button
                              type="button"
                              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700"
                              onClick={() => onMarkRead(n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                      {!n.readAt && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-2 text-center bg-slate-50">
                  <Link to="/app/notifications" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
                    View all notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <Link
            to="/app/profile"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            title="Profile"
          >
            <CircleUserRound size={18} />
          </Link>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition ml-0.5"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
