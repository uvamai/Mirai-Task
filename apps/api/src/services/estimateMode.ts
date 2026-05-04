import type { Board } from '../models/Board';
import type { Project } from '../models/Project';
import type { Tenant } from '../models/Tenant';

export type EstimateMode = 'story_points' | 'hours';

function readMode(raw: unknown): EstimateMode | undefined {
  if (raw === 'story_points' || raw === 'hours') return raw;
  return undefined;
}

export function resolveEstimateMode(
  board: Pick<Board, 'settings'>,
  project: Pick<Project, 'settings'>,
  tenant: Pick<Tenant, 'settings'>
): EstimateMode {
  return (
    readMode(board.settings?.estimateMode) ??
    readMode(project.settings?.estimateMode) ??
    readMode(tenant.settings?.estimateMode) ??
    'story_points'
  );
}

export function estimateUnitLabel(mode: EstimateMode): string {
  return mode === 'hours' ? 'hrs' : 'pts';
}

export function validateEstimateValue(mode: EstimateMode, value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return 'Invalid estimate';
  if (mode === 'story_points') {
    if (!Number.isInteger(value)) return 'Story points must be a whole number';
    if (value < 0 || value > 100) return 'Story points must be between 0 and 100';
    return null;
  }
  if (value < 0 || value > 1000) return 'Hours must be between 0 and 1000';
  const stepped = Math.round(value * 2) / 2;
  if (Math.abs(stepped - value) > 1e-6) return 'Hours must use 0.5 increments';
  return null;
}
