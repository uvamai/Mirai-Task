import type { ReactNode } from 'react';

const tones: Record<string, string> = {
  default: 'bg-slate-100 text-slate-800 border-slate-200/80',
  indigo: 'bg-indigo-50 text-indigo-900 border-indigo-200/80',
  amber: 'bg-amber-50 text-amber-900 border-amber-200/80',
  rose: 'bg-rose-50 text-rose-900 border-rose-200/80',
  emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200/80',
};

export function Badge({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone] ?? tones.default} ${className}`}
    >
      {children}
    </span>
  );
}
