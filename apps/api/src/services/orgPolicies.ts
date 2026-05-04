import type { MembershipRole } from '../models/TenantMembership';
import type { TaskPriority } from '../types/task';

export type ProjectCreationPolicy = 'ADMIN_AND_MANAGER' | 'ADMIN_ONLY';
export type WhoCanInvitePolicy = 'ADMIN' | 'ADMIN_AND_MANAGER';
export type InviteMaxRolePolicy = 'MANAGER' | 'EMPLOYEE';

export type OrgPoliciesResolved = {
  projectCreationPolicy: ProjectCreationPolicy;
  whoCanInvite: WhoCanInvitePolicy;
  inviteMaxRole: InviteMaxRolePolicy;
  defaultBoardTemplateKey: string | null;
  defaultSlaStartPolicy: 'on_in_progress' | 'on_create' | 'on_first_leave_backlog' | null;
  defaultSlaDaysByPriority: Partial<Record<TaskPriority, number>> | null;
  legalHold: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Tenant-level org / ITSM-related policy defaults (stored under `tenant.settings`). */
export function resolveOrgPolicies(settings: Record<string, unknown> | null | undefined): OrgPoliciesResolved {
  const s = settings ?? {};
  const org = asRecord(s.orgPolicies);
  const pol =
    org.projectCreationPolicy === 'ADMIN_ONLY' || org.projectCreationPolicy === 'ADMIN_AND_MANAGER'
      ? org.projectCreationPolicy
      : 'ADMIN_AND_MANAGER';

  const tmpl = org.defaultBoardTemplateKey;
  const defaultBoardTemplateKey = typeof tmpl === 'string' && tmpl.length > 0 ? tmpl : null;

  const ssp = org.defaultSlaStartPolicy;
  const defaultSlaStartPolicy =
    ssp === 'on_in_progress' || ssp === 'on_create' || ssp === 'on_first_leave_backlog' ? ssp : null;

  const daysRaw = org.defaultSlaDaysByPriority;
  let defaultSlaDaysByPriority: Partial<Record<TaskPriority, number>> | null = null;
  if (daysRaw && typeof daysRaw === 'object' && !Array.isArray(daysRaw)) {
    const d = daysRaw as Record<string, unknown>;
    const out: Partial<Record<TaskPriority, number>> = {};
    for (const p of ['P0', 'P1', 'P2', 'P3', 'P4'] as const) {
      const n = d[p];
      if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 90) out[p] = n;
    }
    defaultSlaDaysByPriority = Object.keys(out).length ? out : null;
  }

  const legalHold = s.legalHold === true || org.legalHold === true;

  const whoRaw = org.whoCanInvite;
  const whoCanInvite: WhoCanInvitePolicy = whoRaw === 'ADMIN' ? 'ADMIN' : 'ADMIN_AND_MANAGER';

  const imr = org.inviteMaxRole;
  const inviteMaxRole: InviteMaxRolePolicy = imr === 'EMPLOYEE' ? 'EMPLOYEE' : 'MANAGER';

  return {
    projectCreationPolicy: pol === 'ADMIN_ONLY' ? 'ADMIN_ONLY' : 'ADMIN_AND_MANAGER',
    whoCanInvite,
    inviteMaxRole,
    defaultBoardTemplateKey,
    defaultSlaStartPolicy,
    defaultSlaDaysByPriority,
    legalHold,
  };
}

export function assertManagerMayCreateProject(
  membershipRole: string | undefined,
  policies: OrgPoliciesResolved
): void {
  if (membershipRole === 'MANAGER' && policies.projectCreationPolicy === 'ADMIN_ONLY') {
    const err = new Error('Managers cannot create projects for this organization');
    (err as Error & { code?: string }).code = 'ORG_POLICY_PROJECT_CREATE';
    throw err;
  }
}

export function assertMembershipMayInviteTenant(
  membershipRole: string | undefined,
  policies: OrgPoliciesResolved
): void {
  if (policies.whoCanInvite === 'ADMIN' && membershipRole !== 'ADMIN') {
    const err = new Error('Only tenant administrators can send invitations for this organization');
    (err as Error & { code?: string }).code = 'ORG_POLICY_INVITE';
    throw err;
  }
}

export function assertInviteRoleWithinPolicy(invitedRole: MembershipRole, policies: OrgPoliciesResolved): void {
  if (policies.inviteMaxRole === 'EMPLOYEE' && invitedRole === 'MANAGER') {
    const err = new Error('Organization policy does not allow inviting managers');
    (err as Error & { code?: string }).code = 'ORG_POLICY_INVITE_ROLE';
    throw err;
  }
}
