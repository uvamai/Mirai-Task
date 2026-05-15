import Joi from 'joi';

export const createAgentSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  type: Joi.string().max(64).default('orchestrator'),
});

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(512).required(),
  description: Joi.string().allow('', null),
  priority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').required(),
  status: Joi.string().max(64).default('Backlog'),
  tags: Joi.array().items(Joi.string()).default([]),
  estimate: Joi.number().min(0).allow(null),
  dueDate: Joi.string().isoDate().allow(null),
  startDate: Joi.string().isoDate().allow(null),
  metadata: Joi.object().unknown(true).default({}),
  parentTaskId: Joi.string().uuid().allow(null).optional(),
});

export const patchTaskSchema = Joi.object({
  title: Joi.string().min(1).max(512),
  description: Joi.string().allow('', null),
  priority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4'),
  status: Joi.string().max(64),
  position: Joi.number(),
  tags: Joi.array().items(Joi.string()),
  estimate: Joi.number().allow(null),
  resolution: Joi.string().allow('', null).max(8000),
  blockedReason: Joi.string().allow('', null).max(2000),
  dueDate: Joi.string().isoDate().allow(null),
  startDate: Joi.string().isoDate().allow(null),
  metadata: Joi.object().unknown(true),
  dependencies: Joi.array().items(Joi.string().uuid()).max(25),
  parentTaskId: Joi.string().uuid().allow(null),
}).min(1);

export const assignTaskSchema = Joi.object({
  assigneeType: Joi.string().valid('user', 'agent').required(),
  assigneeId: Joi.string().required(),
  reason: Joi.string().allow('', null),
});

export const reassignTaskSchema = Joi.object({
  toType: Joi.string().valid('user', 'agent').required(),
  toId: Joi.string().required(),
  reason: Joi.string().min(1).required(),
});

export const slaReasonSchema = Joi.object({
  reason: Joi.string().min(1).required(),
});

export const agentLogSchema = Joi.object({
  taskId: Joi.string().uuid().required(),
  message: Joi.string().min(1).max(4000).required(),
});

export const agentMoveSchema = Joi.object({
  taskId: Joi.string().uuid().required(),
  status: Joi.string().max(64).required(),
});

export const taskCommentBodySchema = Joi.object({
  body: Joi.string().min(1).max(8000).required(),
});

export const taskCsatSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null).max(2000),
});
