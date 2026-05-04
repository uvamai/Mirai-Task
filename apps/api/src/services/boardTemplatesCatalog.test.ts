import {
  getBoardTemplate,
  listBoardTemplateKeys,
  listBoardTemplatesMerged,
  listBoardTemplatesPublic,
} from './boardTemplatesCatalog';
import type { Tenant } from '../models/Tenant';

describe('boardTemplatesCatalog', () => {
  it('lists at least the 14 category templates from the core PM plan', () => {
    const keys = listBoardTemplateKeys();
    expect(keys.length).toBeGreaterThanOrEqual(14);
    for (const k of [
      'default',
      'software_development',
      'product_management',
      'marketing',
      'design',
      'project_management',
      'operations',
      'it_support',
      'human_resources',
      'customer_service',
      'legal',
      'finance',
      'sales',
      'data_science',
      'other',
    ]) {
      expect(keys).toContain(k);
    }
  });

  it('public list shape matches API contract', () => {
    const pub = listBoardTemplatesPublic();
    expect(pub.length).toBeGreaterThanOrEqual(14);
    const first = pub.find((t) => t.templateKey === 'software_development');
    expect(first?.label).toBeTruthy();
    expect(Array.isArray(first?.defaultStages)).toBe(true);
    expect(Array.isArray(first?.sampleTasks)).toBe(true);
  });

  it('returns null for unknown keys', () => {
    expect(getBoardTemplate('__no_such_template__')).toBeNull();
  });

  it('merges tenant custom templates', () => {
    const tenant = {
      settings: {
        customBoardTemplates: [
          {
            templateKey: 'acme_ops',
            label: 'ACME ops',
            defaultStages: ['A', 'B', 'C'],
            sampleTasks: [],
          },
        ],
      },
    } as unknown as Tenant;
    expect(getBoardTemplate('acme_ops', tenant)?.label).toBe('ACME ops');
    const merged = listBoardTemplatesMerged(tenant);
    expect(merged.some((t) => t.templateKey === 'acme_ops')).toBe(true);
  });
});
