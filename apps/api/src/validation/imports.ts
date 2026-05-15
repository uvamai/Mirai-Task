import Joi from 'joi';

const targetSchema = Joi.alternatives().try(
  Joi.string().valid(
    'skip',
    'title',
    'description',
    'status',
    'priority',
    'assignee',
    'tags',
    'startDate',
    'dueDate',
    'estimate'
  ),
  Joi.object({
    kind: Joi.string().valid('customField').required(),
    key: Joi.string()
      .max(64)
      .pattern(/^[a-z][a-z0-9_]*$/)
      .required(),
  })
);

export const importCommitSchema = Joi.object({
  uploadId: Joi.string().max(64).required(),
  sheetName: Joi.string().max(255).required(),
  boardName: Joi.string().min(1).max(255).required(),
  mapping: Joi.array().items(targetSchema).min(1).max(200).required(),
  defaults: Joi.object({
    priority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').default('P3'),
    status: Joi.string().min(1).max(64).default('Backlog'),
  }).default({ priority: 'P3', status: 'Backlog' }),
  dateLocale: Joi.string().valid('us', 'row').default('us'),
  deriveStagesFromStatus: Joi.boolean().default(true),
  insertSampleRows: Joi.boolean().default(false),
  /** P5: persist this mapping on tenant.settings.importPresets keyed by headersSignature. */
  savePreset: Joi.boolean().default(true),
});

export const bulkMemberSchema = Joi.object({
  entries: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.object({
          userId: Joi.string().uuid().required(),
          role: Joi.string().valid('LEAD', 'CONTRIBUTOR', 'VIEWER').default('CONTRIBUTOR'),
        }),
        Joi.object({
          email: Joi.string().email().required(),
          role: Joi.string().valid('LEAD', 'CONTRIBUTOR', 'VIEWER').default('CONTRIBUTOR'),
          invitationRole: Joi.string().valid('MANAGER', 'EMPLOYEE').default('EMPLOYEE'),
        })
      )
    )
    .min(1)
    .max(200)
    .required(),
});
