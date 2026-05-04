import Joi from 'joi';

export type CustomFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
};

export function parseCustomFieldDefs(raw: unknown): CustomFieldDef[] {
  const o = raw as { fields?: unknown } | null;
  if (!o || !Array.isArray(o.fields)) return [];
  return o.fields.filter((x): x is CustomFieldDef => {
    if (!x || typeof x !== 'object') return false;
    const f = x as Record<string, unknown>;
    return (
      typeof f.key === 'string' &&
      typeof f.label === 'string' &&
      (f.type === 'text' || f.type === 'number' || f.type === 'select')
    );
  }) as CustomFieldDef[];
}

/** Reserved task.metadata keys (ITSM / public intake / CSAT). Custom field keys must not collide. */
const RESERVED_METADATA: Record<string, Joi.Schema> = {
  itsmMajorIncidentId: Joi.string().uuid().allow(null, ''),
  itsmProblemId: Joi.string().uuid().allow(null, ''),
  changeWindowStart: Joi.string().isoDate().allow(null, ''),
  changeWindowEnd: Joi.string().isoDate().allow(null, ''),
  reporterEmail: Joi.string().email().max(320).allow(null, ''),
  requestTypeKey: Joi.string().max(64).allow(null, ''),
  source: Joi.string().max(32).allow(null, ''),
  csat: Joi.object({
    score: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().allow('', null).max(2000),
    recordedAt: Joi.string().isoDate().required(),
  }).allow(null),
  subtasks: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().max(64).required(),
        title: Joi.string().max(512).required(),
        done: Joi.boolean().default(false),
      })
    )
    .max(100)
    .allow(null),
};

export function buildMetadataValidator(defs: CustomFieldDef[]) {
  const shape: Record<string, Joi.Schema> = {};
  for (const d of defs) {
    if (d.type === 'text') shape[d.key] = Joi.string().allow('', null).max(2000);
    else if (d.type === 'number') shape[d.key] = Joi.number().allow(null);
    else shape[d.key] = Joi.string().valid(...(d.options ?? [])).allow(null);
  }
  return Joi.object({ ...shape, ...RESERVED_METADATA }).unknown(false);
}

export function validateTaskMetadata(projectSettings: Record<string, unknown>, metadata: unknown): string | null {
  const defs = parseCustomFieldDefs(projectSettings?.customFieldDefs);
  const schema = buildMetadataValidator(defs);
  const { error } = schema.validate(metadata ?? {}, { abortEarly: false });
  return error ? error.message : null;
}
