import { Op } from 'sequelize';
import { ProjectMember, TenantMembership } from '../models';

/** Ensures every tenant ADMIN/MANAGER has a LEAD row on the project (enterprise default). */
export async function syncAdminManagerProjectLeads(tenantId: string, projectId: string): Promise<void> {
  const memberships = await TenantMembership.findAll({
    where: { tenantId, role: { [Op.in]: ['ADMIN', 'MANAGER'] } },
  });
  for (const m of memberships) {
    await ProjectMember.findOrCreate({
      where: { projectId, userId: m.userId },
      defaults: { tenantId, projectId, userId: m.userId, role: 'LEAD' },
    });
  }
}
