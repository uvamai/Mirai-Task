import { Link } from 'react-router-dom';

export function ProjectHeader({
  projectName,
  onBackToProjects,
}: {
  projectName: string;
  onBackToProjects?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link to={onBackToProjects ?? '/app'} className="text-xs font-semibold text-indigo-700">
          ← Projects
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{projectName}</h1>
          <span className="rounded-lg border border-slate-200 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            Spaces
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          onClick={() => alert('Project actions (coming soon)')}
        >
          •••
        </button>
      </div>
    </div>
  );
}

