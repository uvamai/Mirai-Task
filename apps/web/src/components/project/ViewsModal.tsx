import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type ViewType = {
  id: string;
  name: string;
  description: string;
  path: string;
  comingSoon?: boolean;
};

const VIEWS: ViewType[] = [
  { id: 'list', name: 'List', description: 'Grouped rows with columns', path: 'list' },
  { id: 'board', name: 'Board', description: 'Kanban by status', path: '' },
  { id: 'calendar', name: 'Calendar', description: 'Due dates on a calendar', path: 'calendar' },
  { id: 'gantt', name: 'Gantt', description: 'Timeline & dependencies', path: 'gantt' },
  { id: 'table', name: 'Table', description: 'Dense HTML table (same data as List)', path: 'table' },
  { id: 'timeline', name: 'Timeline', description: 'Schedule across resources', path: 'timeline' },
  { id: 'docs', name: 'Docs', description: 'Wiki & pages', path: 'docs' },
  { id: 'forms', name: 'Forms', description: 'Intake & surveys', path: 'forms' },
];

type Props = {
  projectId: string;
  boardId?: string;
  open: boolean;
  onClose: () => void;
};

export function ViewsModal({ projectId, boardId, open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/50 bg-white/90 p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Views</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open a saved view type for this board. Gantt and advanced views ship in later phases.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                disabled={view.comingSoon}
                onClick={() => {
                  let path = '';
                  if (view.id === 'docs' || view.id === 'forms') {
                    path = `/app/projects/${projectId}/${view.path}`;
                  } else {
                    const base = boardId ? `/app/projects/${projectId}/boards/${boardId}` : `/app/projects/${projectId}`;
                    path = view.path ? `${base}/${view.path}` : base;
                  }
                  navigate(path);
                  onClose();
                }}
                className={`group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 ${
                  view.comingSoon
                    ? 'border-slate-100 bg-slate-50/50 opacity-60'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98]'
                }`}
              >
                <div className="text-base font-bold text-slate-900 group-hover:text-indigo-600">
                  {view.name}
                </div>
                <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {view.description}
                </div>
                {view.comingSoon && (
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-orange-600">
                    Coming Soon
                  </div>
                )}
                {!view.comingSoon && (
                  <div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-indigo-500">→</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
