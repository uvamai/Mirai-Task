import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import type { CustomFieldDef } from '../features/tasks/types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { boardShellAppPath } from '../hooks/useBoardShellView';

type SimpleTarget =
  | 'skip'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'tags'
  | 'startDate'
  | 'dueDate'
  | 'estimate';

type CustomFieldTarget = { kind: 'customField'; key: string };

type MappingTarget = SimpleTarget | CustomFieldTarget;

const STANDARD_TARGETS: { value: SimpleTarget; label: string }[] = [
  { value: 'skip', label: 'Skip this column' },
  { value: 'title', label: 'Title (required)' },
  { value: 'description', label: 'Description' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee / Owner' },
  { value: 'tags', label: 'Tags / Labels' },
  { value: 'startDate', label: 'Start date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'estimate', label: 'Estimate' },
];

type SheetSnapshot = {
  name: string;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  distinct: { status: string[]; priority: string[]; owner: string[] };
  suggestedMapping: MappingTarget[];
};

type PreviewResponse = {
  uploadId: string;
  fileHash: string;
  headersSignature: string;
  originalFilename: string;
  suggestedBoardName: string;
  sheets: SheetSnapshot[];
  customFieldDefs: CustomFieldDef[];
  matchedPreset?: { mapping: MappingTarget[]; savedAt: string | null } | null;
  existingImport?: {
    boardId: string;
    boardName: string;
    projectId: string;
    importedAt?: string;
  } | null;
};

type CommitResponse = {
  boardId: string;
  name: string;
  kanbanStages: string[];
  taskCount: number;
  skipped: { row: number; reason: string }[];
  unresolvedOwners: { row: number; raw: string }[];
  undoExpiresAt: string;
  autoAddedMemberIds?: string[];
};

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

function serializeTarget(t: MappingTarget): string {
  if (typeof t === 'string') return t;
  return `cf:${t.key}`;
}

function parseTarget(s: string): MappingTarget {
  if (s.startsWith('cf:')) return { kind: 'customField', key: s.slice(3) };
  return s as SimpleTarget;
}

export function ImportExcelModal({ projectId, open, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'confirm' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [boardName, setBoardName] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<MappingTarget[]>([]);
  const [dateLocale, setDateLocale] = useState<'us' | 'row'>('us');
  const [derive, setDerive] = useState(true);
  const [defaults, setDefaults] = useState({ priority: 'P3', status: 'Backlog' });
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentSheet = preview?.sheets[sheetIdx] ?? null;

  const previewMut = useMutation({
    mutationFn: async (f: File): Promise<PreviewResponse> => {
      const fd = new FormData();
      fd.append('file', f);
      const res = await apiFetch(`/projects/${projectId}/imports/excel/preview`, {
        method: 'POST',
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Preview failed');
      return body as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreview(data);
      setSheetIdx(0);
      /** Prefer the matched preset's mapping (if any) over the header guess. */
      const preset = data.matchedPreset?.mapping;
      const initialMapping =
        preset && preset.length === (data.sheets[0]?.headers.length ?? 0)
          ? preset
          : (data.sheets[0]?.suggestedMapping ?? []);
      setMapping(initialMapping);
      if (!boardName.trim()) setBoardName(data.suggestedBoardName);
      setStep('map');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const commitMut = useMutation({
    mutationFn: async (): Promise<CommitResponse> => {
      if (!preview || !currentSheet) throw new Error('No preview loaded');
      const res = await apiFetch(`/projects/${projectId}/imports/excel/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: preview.uploadId,
          sheetName: currentSheet.name,
          boardName: boardName.trim() || preview.suggestedBoardName || 'Imported board',
          mapping,
          defaults,
          dateLocale,
          deriveStagesFromStatus: derive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Commit failed');

      /** 202 → async path: poll the job endpoint until it completes. */
      if (res.status === 202 && (body as { jobId?: string }).jobId) {
        const jobId = (body as { jobId: string }).jobId;
        const started = Date.now();
        while (Date.now() - started < 5 * 60_000) {
          await new Promise((r) => setTimeout(r, 2_500));
          const poll = await apiFetch(`/projects/${projectId}/imports/excel/jobs/${jobId}`);
          if (!poll.ok) continue;
          const job = (await poll.json()) as {
            state: string;
            boardId?: string;
            lastError?: string | null;
            result?: CommitResponse | null;
          };
          if (job.state === 'completed' && job.result) return job.result;
          if (job.state === 'failed') throw new Error(job.lastError || 'Import failed in worker');
        }
        throw new Error('Import is taking longer than expected — check the activity log');
      }
      return body as CommitResponse;
    },
    onSuccess: (data) => {
      setCommitResult(data);
      setStep('done');
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const titleCount = useMemo(() => mapping.filter((m) => m === 'title').length, [mapping]);
  const canProceedFromMap = titleCount === 1 && (currentSheet?.rowCount ?? 0) > 0;

  function reset() {
    setFile(null);
    setBoardName('');
    setPreview(null);
    setMapping([]);
    setStep('upload');
    setCommitResult(null);
    setError(null);
  }

  function closeAndReset() {
    reset();
    onClose();
  }

  async function downloadTemplate() {
    try {
      const res = await apiFetch(`/projects/${projectId}/imports/excel/template.xlsx`);
      if (!res.ok) throw new Error('Template download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mirai-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Focus trap + ESC attach only while the modal is open. */
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, open);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAndReset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // closeAndReset captures latest onClose via setState; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import from Excel"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import from Excel</h2>
            <p className="mt-1 text-xs text-slate-600">
              Each file becomes a new board. Map your spreadsheet columns to task fields; the rest are skipped.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAndReset}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <ol className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          {(['upload', 'map', 'confirm', 'done'] as const).map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-2 ${
                step === s ? 'text-slate-900' : ''
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                  step === s ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {i + 1}
              </span>
              <span className="uppercase tracking-wide">{s}</span>
            </li>
          ))}
        </ol>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <label className="text-xs font-semibold text-slate-700">
                Board name
                <input
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="e.g. SuperLinkIT Sprint 1"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                />
              </label>
              <button
                type="button"
                onClick={() => void downloadTemplate()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Download starter template
              </button>
            </div>
            <div
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0] ?? null;
                if (f) setFile(f);
              }}
            >
              <p className="text-sm font-semibold text-slate-800">
                {file ? file.name : 'Drop an .xlsx, .xls, or .csv file here'}
              </p>
              <p className="text-xs text-slate-500">Up to 5&nbsp;MB. Manager/Admin only.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) setFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Choose file
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={!file || previewMut.isPending}
                onClick={() => file && previewMut.mutate(file)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {previewMut.isPending ? 'Reading file…' : 'Next: map columns'}
              </button>
            </div>
          </div>
        )}

        {step === 'map' && preview && currentSheet && (
          <div className="mt-5 space-y-4">
            {preview.sheets.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-slate-700">Sheet</label>
                <select
                  value={sheetIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSheetIdx(idx);
                    setMapping(preview.sheets[idx]?.suggestedMapping ?? []);
                  }}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {preview.sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name} ({s.rowCount} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-xs text-slate-600">
              <strong>{currentSheet.rowCount}</strong> rows · <strong>{currentSheet.headers.length}</strong>{' '}
              columns. Map each spreadsheet column to a task field, or leave as <em>Skip</em>.
            </p>
            {preview.matchedPreset && (
              <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                Reused a saved mapping for this column shape
                {preview.matchedPreset.savedAt
                  ? ` (saved ${new Date(preview.matchedPreset.savedAt).toLocaleDateString()})`
                  : ''}
                . Override below if needed.
              </p>
            )}
            {preview.existingImport && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                A file with this exact content was already imported in the last 24h as{' '}
                <strong>{preview.existingImport.boardName}</strong>. Importing again will create a second
                board with the same rows.
              </p>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Spreadsheet column</th>
                    <th className="px-3 py-2">Sample values</th>
                    <th className="px-3 py-2">Map to</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSheet.headers.map((h, ci) => (
                    <tr key={`${h}-${ci}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-800">{h || <em>(blank)</em>}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {currentSheet.sampleRows
                          .slice(0, 3)
                          .map((r) => r[ci])
                          .filter(Boolean)
                          .map((s, i) => (
                            <span
                              key={i}
                              className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                            >
                              {String(s).slice(0, 32)}
                            </span>
                          ))}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={serializeTarget(mapping[ci] ?? 'skip')}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[ci] = parseTarget(e.target.value);
                            setMapping(next);
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          {STANDARD_TARGETS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                          {preview.customFieldDefs.map((d) => (
                            <option key={d.key} value={`cf:${d.key}`}>
                              Custom field · {d.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {titleCount !== 1 && (
              <p className="text-xs font-semibold text-rose-700">
                Exactly one column must be mapped to <em>Title</em> (currently {titleCount}).
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">
                Date format
                <select
                  value={dateLocale}
                  onChange={(e) => setDateLocale(e.target.value as 'us' | 'row')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                >
                  <option value="us">MM/DD/YYYY (US)</option>
                  <option value="row">DD/MM/YYYY (rest of world)</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Default priority
                <select
                  value={defaults.priority}
                  onChange={(e) => setDefaults((d) => ({ ...d, priority: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                >
                  {['P0', 'P1', 'P2', 'P3', 'P4'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Default status
                <input
                  value={defaults.status}
                  onChange={(e) => setDefaults((d) => ({ ...d, status: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={derive}
                onChange={(e) => setDerive(e.target.checked)}
              />
              Derive Kanban columns from distinct Status values
            </label>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canProceedFromMap}
                onClick={() => setStep('confirm')}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next: review
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && preview && currentSheet && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{boardName}</p>
              <p className="mt-1 text-xs text-slate-600">
                Sheet <strong>{currentSheet.name}</strong> · <strong>{currentSheet.rowCount}</strong> rows ·{' '}
                <strong>{mapping.filter((m) => m !== 'skip').length}</strong> mapped columns.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Date format <strong>{dateLocale === 'us' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'}</strong> · default
                priority <strong>{defaults.priority}</strong> · default status{' '}
                <strong>{defaults.status}</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Kanban columns will be{' '}
                {derive ? (
                  <span>
                    derived from your <em>Status</em> values
                  </span>
                ) : (
                  <span>
                    <code>Backlog → In Progress → In Review → Done</code>
                  </span>
                )}
                .
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('map')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={commitMut.isPending}
                onClick={() => commitMut.mutate()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {commitMut.isPending ? 'Creating board…' : 'Create board'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && commitResult && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                Board <strong>{commitResult.name}</strong> created with{' '}
                <strong>{commitResult.taskCount}</strong> tasks.
              </p>
              {commitResult.skipped.length > 0 && (
                <p className="mt-1 text-xs text-emerald-900">
                  {commitResult.skipped.length} row(s) skipped (no title).
                </p>
              )}
              {commitResult.unresolvedOwners.length > 0 && (
                <p className="mt-1 text-xs text-emerald-900">
                  {commitResult.unresolvedOwners.length} owner reference(s) need follow-up — you'll see them on
                  the board.
                </p>
              )}
              {(commitResult.autoAddedMemberIds?.length ?? 0) > 0 && (
                <p className="mt-1 text-xs text-emerald-900">
                  Auto-added {commitResult.autoAddedMemberIds!.length} tenant member(s) to this project as
                  contributors.
                </p>
              )}
              <p className="mt-2 text-[11px] text-emerald-800">
                Undo is available for 5 minutes from the new board's toolbar.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAndReset}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = commitResult.boardId;
                  closeAndReset();
                  navigate(boardShellAppPath(projectId, id));
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Open board
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
