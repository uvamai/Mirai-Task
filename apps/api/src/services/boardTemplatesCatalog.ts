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

export function getBoardTemplate(key: string, tenant?: Tenant | null): BoardTemplateDefinition | null {
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
