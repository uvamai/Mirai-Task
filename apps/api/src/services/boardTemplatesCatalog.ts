import raw from '../config/boardTemplates.json';
import type { Tenant } from '../models/Tenant';

export type BoardTemplateDefinition = {
  label: string;
  description?: string;
  businessType: string;
  defaultStages: string[];
  defaultEstimateMode: 'story_points' | 'hours' | null;
  sampleTasks: { title: string; status: string; priority: string }[];
};

export type CustomBoardTemplate = {
  templateKey: string;
  label: string;
  description?: string;
  businessType?: string;
  defaultStages: string[];
  defaultEstimateMode?: 'story_points' | 'hours' | null;
  sampleTasks?: BoardTemplateDefinition['sampleTasks'];
};

const catalog = raw as Record<string, BoardTemplateDefinition>;

/** Synthetic template used by Excel import. Stages always come from the file/settings, never from here. */
export const EXCEL_IMPORT_TEMPLATE_KEY = 'excel_import';

const EXCEL_IMPORT_TEMPLATE: BoardTemplateDefinition = {
  label: 'Excel import',
  description: 'Board created from an Excel/CSV upload. Stages are derived from the file at import time.',
  businessType: 'general',
  defaultStages: ['Backlog', 'In Progress', 'In Review', 'Done'],
  defaultEstimateMode: null,
  sampleTasks: [],
};

export function getBoardTemplate(key: string, tenant?: Tenant | null): BoardTemplateDefinition | null {
  if (key === EXCEL_IMPORT_TEMPLATE_KEY) return EXCEL_IMPORT_TEMPLATE;
  const fromCatalog = catalog[key];
  if (fromCatalog) return fromCatalog;
  const custom = tenant?.settings?.customBoardTemplates as CustomBoardTemplate[] | undefined;
  const c = custom?.find((x) => x.templateKey === key);
  if (!c) return null;
  return {
    label: c.label,
    description: c.description ?? '',
    businessType: c.businessType ?? 'general',
    defaultStages: c.defaultStages,
    defaultEstimateMode: c.defaultEstimateMode ?? null,
    sampleTasks: c.sampleTasks ?? [],
  };
}

export function listBoardTemplateKeys(): string[] {
  return Object.keys(catalog);
}

export function listBoardTemplatesPublic(): {
  templateKey: string;
  label: string;
  description?: string;
  businessType: string;
  defaultStages: string[];
  sampleTasks: BoardTemplateDefinition['sampleTasks'];
}[] {
  return Object.entries(catalog).map(([templateKey, def]) => ({
    templateKey,
    label: def.label,
    description: def.description,
    businessType: def.businessType,
    defaultStages: def.defaultStages,
    sampleTasks: def.sampleTasks,
  }));
}

export function listBoardTemplatesMerged(tenant: Tenant | null): {
  templateKey: string;
  label: string;
  description?: string;
  businessType: string;
  defaultStages: string[];
  sampleTasks: BoardTemplateDefinition['sampleTasks'];
}[] {
  const base = listBoardTemplatesPublic();
  const keys = new Set(base.map((b) => b.templateKey));
  const custom = (tenant?.settings?.customBoardTemplates as CustomBoardTemplate[] | undefined) ?? [];
  const extra = custom
    .filter((c) => c.templateKey && !keys.has(c.templateKey))
    .map((c) => ({
      templateKey: c.templateKey,
      label: c.label,
      description: c.description,
      businessType: c.businessType ?? 'custom',
      defaultStages: c.defaultStages,
      sampleTasks: c.sampleTasks ?? [],
    }));
  return [...base, ...extra];
}

export function getBoardTemplatePublicByKey(key: string) {
  const def = getBoardTemplate(key);
  if (!def) return null;
  return {
    templateKey: key,
    label: def.label,
    description: def.description,
    businessType: def.businessType,
    defaultStages: def.defaultStages,
    defaultEstimateMode: def.defaultEstimateMode,
    sampleTasks: def.sampleTasks,
  };
}
