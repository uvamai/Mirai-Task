export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MIRAI Tasker API',
    version: '0.1.0',
    description: 'Multi-tenant SaaS API (scaffold). Use Bearer JWT from /auth/login or /auth/register.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'OK' },
          '503': { description: 'Database unavailable' },
        },
      },
    },
    '/public/plans': {
      get: {
        summary: 'Public subscription plans (safe fields)',
        responses: { '200': { description: 'Plan catalog' } },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register user and tenant (admin membership)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName', 'organizationName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 12 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  organizationName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation or password policy' },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  tenantId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Tokens' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current user + tenant context',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Profile' } },
      },
    },
    '/projects': {
      get: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Project list' } },
      },
      post: {
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Created' }, '403': { description: 'Plan limit' } },
      },
    },
    '/projects/{projectId}/kanban-stages': {
      get: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Default and optional custom stages' } },
      },
    },
    '/boards/{boardId}/tasks': {
      get: {
        summary: 'List tasks for a board',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'boardId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Task list + estimate meta' },
          '403': { description: 'Project access' },
          '404': { description: 'Board not found' },
        },
      },
      post: {
        summary: 'Create task on board (Admin/Manager)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'boardId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '201': { description: 'Task created' },
          '403': { description: 'Insufficient role or subscription read-only' },
        },
      },
    },
    '/tasks/{taskId}': {
      get: {
        summary: 'Task detail and activity',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Task + activity' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Update task fields / status / position',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Invalid transition or validation' },
          '403': { description: 'Subscription read-only or role' },
        },
      },
    },
    '/tasks/{taskId}/assign': {
      post: {
        summary: 'Assign task to user or agent',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Role' } },
      },
    },
    '/tasks/{taskId}/reassign': {
      post: {
        summary: 'Reassign with reason (Admin/Manager)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/tasks/{taskId}/sla/pause': {
      post: {
        summary: 'Pause SLA (reason body)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/tasks/{taskId}/sla/resume': {
      post: {
        summary: 'Resume SLA',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/employees': {
      get: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Employee profiles' } },
      },
    },
    '/tenants/{tenantId}/billing': {
      get: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Billing snapshot' } },
      },
    },
    '/tenants/{tenantId}/billing/checkout-session': {
      post: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Stripe Checkout URL' }, '400': { description: 'Mock mode or misconfiguration' } },
      },
    },
    '/webhooks/stripe': {
      post: {
        summary: 'Stripe webhooks (raw JSON body, Stripe-Signature)',
        responses: { '200': { description: 'Received' }, '400': { description: 'Invalid signature' } },
      },
    },
    '/admin/activity': {
      get: {
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Audit log entries' } },
      },
    },
    '/projects/{projectId}/imports/excel/template.xlsx': {
      get: {
        summary: 'Download a project-aware starter template (Admin/Manager).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Binary .xlsx template' },
          '403': { description: 'Insufficient role or project access' },
          '404': { description: 'Project not found' },
        },
      },
    },
    '/projects/{projectId}/imports/excel/preview': {
      post: {
        summary: 'Upload an Excel/CSV file and return a non-persisted snapshot (Admin/Manager).',
        description:
          'Accepts multipart with a single `file` field (≤ 5 MB; .xlsx, .xls, .csv, .ods). Returns sheets, headers, sample rows, distinct values, suggested mapping, and a matched preset (if any). The buffer is staged under storage/<tenantId>/excel-imports/<uploadId>.bin until commit, cancel, or 24h TTL sweep.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Preview snapshot' },
          '400': { description: 'Parse failure or missing file' },
          '403': { description: 'Insufficient role or project access' },
          '413': { description: 'File too large' },
        },
      },
    },
    '/projects/{projectId}/imports/excel/commit': {
      post: {
        summary: 'Create a new board + tasks from a staged Excel upload (Admin/Manager).',
        description:
          'Transactional. Runs `assertCanCreateBoard` + plan-aware row cap + per-tenant rate limit before inserting; writes a `board.import.excel` activity entry and stores `importMeta` (including a 5-minute `undoExpiresAt`) on the new board. If the file has > 2000 rows the request returns 202 with a `jobId` and the worker drains it.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['uploadId', 'sheetName', 'boardName', 'mapping'],
                properties: {
                  uploadId: { type: 'string', maxLength: 64 },
                  sheetName: { type: 'string', maxLength: 255 },
                  boardName: { type: 'string', minLength: 1, maxLength: 255 },
                  mapping: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 200,
                    items: {
                      oneOf: [
                        {
                          type: 'string',
                          enum: [
                            'skip',
                            'title',
                            'description',
                            'status',
                            'priority',
                            'assignee',
                            'tags',
                            'startDate',
                            'dueDate',
                            'estimate',
                          ],
                        },
                        {
                          type: 'object',
                          required: ['kind', 'key'],
                          properties: {
                            kind: { type: 'string', enum: ['customField'] },
                            key: { type: 'string', maxLength: 64 },
                          },
                        },
                      ],
                    },
                  },
                  defaults: {
                    type: 'object',
                    properties: {
                      priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
                      status: { type: 'string', minLength: 1, maxLength: 64 },
                    },
                  },
                  dateLocale: { type: 'string', enum: ['us', 'row'] },
                  deriveStagesFromStatus: { type: 'boolean' },
                  insertSampleRows: { type: 'boolean' },
                  savePreset: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Board + tasks created synchronously' },
          '202': { description: 'Import queued (async path for >2000 rows); returns `jobId`' },
          '400': { description: 'Validation, missing upload, or sheet not found' },
          '403': { description: 'Plan / role / project access' },
          '429': { description: 'Tenant import rate limit reached' },
        },
      },
    },
    '/projects/{projectId}/imports/excel/{uploadId}': {
      delete: {
        summary: 'Cancel a preview and drop the staged buffer.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'uploadId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/projects/{projectId}/imports/excel/jobs/{jobId}': {
      get: {
        summary: 'Poll an async import job created by `commit` (>2000-row path).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'jobId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description:
              'Job status: `queued` | `running` | `completed` (with `boardId`) | `failed` (with `error`)',
          },
          '404': { description: 'Not found' },
        },
      },
    },
    '/projects/{projectId}/boards/{boardId}/undo-import': {
      post: {
        summary: 'Hard-delete an imported board within its 5-minute undo window.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'boardId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Undone' },
          '400': { description: 'Board not import-sourced, or the only board on the project' },
          '410': { description: 'Undo window expired' },
        },
      },
    },
    '/projects/{projectId}/members/bulk': {
      post: {
        summary: 'Add tenant members + invite unknown emails in a single batch (Admin/Manager).',
        description:
          'Used by the post-import "Add referenced people" CTA. Each entry is either `{userId, role}` (existing tenant member) or `{email, role, invitationRole}` (creates a `TenantInvitation`).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '207': { description: 'Multi-status: added / invited / errors' } },
      },
    },
  },
};
