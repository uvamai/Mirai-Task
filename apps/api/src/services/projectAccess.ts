import { Op } from 'sequelize';
import type { MembershipRole } from '../models/TenantMembership';
import { ProjectMember } from '../models/ProjectMember';

export class ProjectAccessError extends Error {
  readonly code = 'PROJECT_ACCESS_DENIED';

  constructor(message = 'No access to this project') {
    super(message);
    this.name = 'ProjectAccessError';
    Object.setPrototypeOf(this, ProjectAccessError.prototype);
  }
}

/** Returns `null` when the user may see all tenant projects (admin/manager). */
export async function listAccessibleProjectIds(
  tenantId: string,
  userId: string,
  tenantRole: MembershipRole | string | undefined
): Promise<string[] | null> {
  if (tenantRole === 'ADMIN' || tenantRole === 'MANAGER') return null;
  const rows = await ProjectMember.findAll({
    where: { tenantId, userId },
    attributes: ['projectId'],
  });
  return rows.map((r) => r.projectId);
}

export async function assertProjectMemberAccess(
  tenantId: string,
  userId: string,
  tenantRole: MembershipRole | string | undefined,
  projectId: string
): Promise<void> {
  /** Admins and managers retain full tenant scope; employees/guests need explicit project membership. */
  if (tenantRole === 'ADMIN' || tenantRole === 'MANAGER') return;
  const row = await ProjectMember.findOne({ where: { tenantId, projectId, userId } });
  if (!row) throw new ProjectAccessError();
}

export async function assertProjectManagerOrAdmin(
  tenantId: string,
  userId: string,
  tenantRole: MembershipRole | string | undefined,
  projectId: string
): Promise<void> {
  if (tenantRole === 'ADMIN') return;
  if (tenantRole === 'MANAGER') {
    const row = await ProjectMember.findOne({
      where: { tenantId, projectId, userId, role: { [Op.in]: ['LEAD', 'CONTRIBUTOR'] } },
    });
    if (!row) throw new ProjectAccessError('Manager must be a project member to manage this project');
    return;
  }
  throw new ProjectAccessError();
}

/** Admin, tenant Manager, or project Lead may edit SLA policy fields. */
export async function assertCanEditSlaPolicy(
  tenantId: string,
  userId: string,
  tenantRole: MembershipRole | string | undefined,
  projectId: string
): Promise<void> {
  if (tenantRole === 'ADMIN' || tenantRole === 'MANAGER') return;
  const row = await ProjectMember.findOne({ where: { tenantId, projectId, userId, role: 'LEAD' } });
  if (row) return;
  throw new ProjectAccessError('Only Admin, Manager, or Project Lead can edit SLA policy');
}

/** Admin, Manager, or Project Lead may view utilization / management reports. */
export async function assertProjectReportAccess(
  tenantId: string,
  userId: string,
  tenantRole: MembershipRole | string | undefined,
  projectId: string
): Promise<void> {
  if (tenantRole === 'ADMIN' || tenantRole === 'MANAGER') return;
  const row = await ProjectMember.findOne({ where: { tenantId, projectId, userId, role: 'LEAD' } });
  if (row) return;
  throw new ProjectAccessError('Only Admin, Manager, or Project Lead can view this report');
}
