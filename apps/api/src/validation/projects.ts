import Joi from 'joi';

export const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  /** Allow empty string from UI selects before templates load; server normalizes to `default`. */
  templateKey: Joi.string().trim().max(64).allow('', null).optional(),
  seedSampleTasks: Joi.boolean().optional().default(false),
});

const slaDay = Joi.number().integer().min(1).max(90);

export const slaDaysByPrioritySchema = Joi.object({
  P0: slaDay,
  P1: slaDay,
  P2: slaDay,
  P3: slaDay,
  P4: slaDay,
}).min(1);
