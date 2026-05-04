import Joi from 'joi';

export const createEmployeeSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
  password: Joi.string().min(12).max(256).required(),
  firstName: Joi.string().max(120).required(),
  lastName: Joi.string().max(120).required(),
  role: Joi.string().valid('ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST').default('EMPLOYEE'),
  department: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().max(64).allow(null, ''),
});

export const patchEmployeeSchema = Joi.object({
  department: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().max(64).allow(null, ''),
  managerId: Joi.string().uuid().allow(null),
  metadata: Joi.object().unknown(true),
});
