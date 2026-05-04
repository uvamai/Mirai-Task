import { useEffect, useMemo, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Overdue';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SlaCountdown({
  slaDeadline,
  paused,
}: {
  slaDeadline: string | null | undefined;
  paused?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!slaDeadline || paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [slaDeadline, paused]);

  const text = useMemo(() => {
    if (!slaDeadline) return '—';
    if (paused) return 'Paused';
    const end = new Date(slaDeadline).getTime();
    return formatRemaining(end - now);
  }, [slaDeadline, paused, now]);

  const overdue = slaDeadline && !paused && new Date(slaDeadline).getTime() < now;

  return (
    <span
      className={`text-[10px] font-semibold tabular-nums ${overdue ? 'text-rose-700' : 'text-slate-600'}`}
      title={slaDeadline ? new Date(slaDeadline).toLocaleString() : undefined}
    >
      SLA {text}
    </span>
  );
}
