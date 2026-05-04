import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { ContactSalesLead } from '../models/ContactSalesLead';

export const contactSalesRouter = Router();

const contactSalesLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.CONTACT_SALES_MAX_PER_IP_PER_HOUR ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
});

const createLeadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  workEmail: Joi.string().trim().email().max(320).required(),
  company: Joi.string().trim().min(1).max(255).required(),
  teamSize: Joi.string().valid('1-25', '26-100', '101-500', '500+').required(),
  message: Joi.string().trim().min(1).max(6000).required(),
  source: Joi.string().trim().max(64).optional(),
});

contactSalesRouter.post('/public/contact-sales', contactSalesLimiter, async (req, res) => {
  const { error, value } = createLeadSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }

  const lead = await ContactSalesLead.create({
    name: value.name,
    workEmail: value.workEmail.toLowerCase(),
    company: value.company,
    teamSize: value.teamSize,
    message: value.message,
    source: value.source ?? 'web_contact_sales_form',
  });
  res.status(201).json({ ok: true, id: lead.id });
});
