import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
  password: Joi.string().min(12).max(256).required(),
  firstName: Joi.string().max(120).required(),
  lastName: Joi.string().max(120).required(),
  organizationName: Joi.string().max(255).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
  password: Joi.string().required(),
  tenantId: Joi.string().uuid().optional(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const patchMePreferencesSchema = Joi.object({
  preferences: Joi.object().unknown(true).required(),
});
