import type { TenantMembership } from '../models/TenantMembership';
import type { Agent } from '../models/Agent';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
      tenantId?: string;
      globalAdminTenantId?: string;
      accessToken?: string;
      membership?: TenantMembership;
      agent?: Agent;
    }
  }
}

export {};
