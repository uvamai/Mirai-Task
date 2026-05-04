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
  },
};
