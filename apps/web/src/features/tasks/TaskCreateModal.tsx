import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { apiFetch } from '../../api/client';
import type { CustomFieldDef } from './types';
import { useTagCatalog } from '../../hooks/useTagCatalog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function estimateSchema(mode: 'story_points' | 'hours') {
  if (mode === 'hours') {
    return Yup.number()
      .min(0)
      .nullable()
      .test('half', 'Use 0.5 hour steps', (v) => v == null || Math.abs(Math.round(v * 2) - v * 2) < 1e-9);
  }
  return Yup.number().integer().min(0).max(100).nullable();
}

type Props = {
  boardId: string;
  estimateMode: 'story_points' | 'hours';
  columns: string[];
  customFieldDefs: CustomFieldDef[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function TaskCreateModal({
  boardId,
  estimateMode,
  columns,
  customFieldDefs,
  open,
  onClose,
  onCreated,
}: Props) {
  const UX_TAG = 'UI/UX improvement';
  const tagCatalogQ = useTagCatalog();
  const catalog = tagCatalogQ.data ?? [];
  if (!open) return null;
  const defaultStatus = columns[0] ?? 'Backlog';
  const label =
    estimateMode === 'hours' ? 'Estimate (hours, 0.5 steps)' : 'Estimate (story points, whole numbers)';

  const metaShape: Record<string, Yup.AnySchema> = {};
  for (const d of customFieldDefs) {
    if (d.type === 'text') metaShape[d.key] = Yup.string().max(2000).nullable();
    else if (d.type === 'number')
      metaShape[d.key] = Yup.number().nullable().transform((v, orig) => (orig === '' ? null : v));
    else {
      const opts = [...(d.options ?? []), '', null] as (string | null)[];
      metaShape[d.key] = Yup.string().nullable().oneOf(opts);
    }
  }

  const initialMeta: Record<string, string | number | ''> = {};
  for (const d of customFieldDefs) {
    initialMeta[d.key] = d.type === 'number' ? '' : '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">New task</h2>
        <Formik
          initialValues={{
            title: '',
            description: '',
            priority: 'P3' as const,
            status: defaultStatus,
            estimate: '' as string | number,
            dueDate: '' as string,
            parentTaskId: '',
            tagUx: false,
            tagsText: '',
            metadata: initialMeta,
          }}
          validationSchema={Yup.object({
            title: Yup.string().min(1).max(512).required('Required'),
            description: Yup.string().max(8000).nullable(),
            priority: Yup.string().oneOf(['P0', 'P1', 'P2', 'P3', 'P4']).required(),
            status: Yup.string().required(),
            estimate: estimateSchema(estimateMode),
            dueDate: Yup.string().nullable(),
            parentTaskId: Yup.string()
              .nullable()
              .transform((v) => (v === '' || v === undefined ? '' : String(v).trim()))
              .test('uuid', 'Invalid parent UUID', (v) => !v || UUID_RE.test(v)),
            metadata: customFieldDefs.length ? Yup.object(metaShape) : Yup.object({}),
          })}
          onSubmit={async (values, { setStatus, resetForm }) => {
            setStatus(undefined);
            const metaOut: Record<string, unknown> = {};
            for (const d of customFieldDefs) {
              const raw = values.metadata[d.key];
              if (d.type === 'number') {
                metaOut[d.key] = raw === '' || raw === undefined ? null : Number(raw);
              } else {
                metaOut[d.key] = raw === '' ? null : raw;
              }
            }
            const due =
              values.dueDate && String(values.dueDate).trim() !== ''
                ? String(values.dueDate).slice(0, 10)
                : null;
            const pt = String(values.parentTaskId ?? '').trim();
            const parsedTags = String(values.tagsText ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 10);
            const tagsOut = Array.from(
              new Set([...(values.tagUx ? [UX_TAG] : []), ...parsedTags].map((s) => s.trim()).filter(Boolean))
            ).slice(0, 10);
            const res = await apiFetch(`/boards/${boardId}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: values.title,
                description: values.description || null,
                priority: values.priority,
                status: values.status,
                tags: tagsOut,
                estimate: values.estimate === '' ? null : Number(values.estimate),
                dueDate: due,
                metadata: metaOut,
                ...(pt ? { parentTaskId: pt } : {}),
              }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus((body as { error?: string }).error ?? 'Failed to create');
              return;
            }
            resetForm();
            onCreated();
            onClose();
          }}
        >
          {({ isSubmitting, status }) => (
            <Form className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Title</label>
                <Field name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <ErrorMessage name="title" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <Field
                  as="textarea"
                  name="description"
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Tags</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <Field type="checkbox" name="tagUx" />
                  {UX_TAG}
                </label>
                {catalog.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Available tags: {catalog.map((t) => t.name).slice(0, 8).join(', ')}
                    {catalog.length > 8 ? '…' : ''}
                  </p>
                )}
                <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Add tags (comma-separated)
                </label>
                <Field
                  name="tagsText"
                  placeholder="e.g. UI/UX improvement, backlog hygiene"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Priority</label>
                  <Field as="select" name="priority" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {(['P0', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Field>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Column</label>
                  <Field as="select" name="status" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Field>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Parent task ID (optional)</label>
                <Field
                  name="parentTaskId"
                  placeholder="UUID within this project"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                />
                <ErrorMessage name="parentTaskId" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Due date</label>
                <Field name="dueDate" type="date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <Field
                  name="estimate"
                  type="number"
                  step={estimateMode === 'hours' ? '0.5' : '1'}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <ErrorMessage name="estimate" component="p" className="mt-1 text-xs text-rose-600" />
              </div>
              {customFieldDefs.length > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Custom fields</p>
                  {customFieldDefs.map((d) => (
                    <div key={d.key}>
                      <label className="text-xs font-semibold text-slate-600">{d.label}</label>
                      {d.type === 'select' ? (
                        <Field as="select" name={`metadata.${d.key}`} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          <option value="">—</option>
                          {(d.options ?? []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Field>
                      ) : (
                        <Field
                          name={`metadata.${d.key}`}
                          type={d.type === 'number' ? 'number' : 'text'}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {status && <p className="text-sm text-rose-700">{status}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating…' : 'Create'}
                </button>
                <button type="button" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
