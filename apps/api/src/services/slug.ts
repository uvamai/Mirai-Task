import { randomBytes } from 'crypto';

export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return base || 'organization';
}

export function uniqueSlugAttempt(base: string): string {
  const suffix = randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}
