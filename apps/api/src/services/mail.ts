import { logger } from '../logger';

/**
 * Invitation delivery. Configure SMTP later (e.g. nodemailer); until then the API logs the accept URL
 * (server-side only) so operators can forward invites in staging.
 */
export async function sendTenantInvitationEmail(options: {
  to: string;
  acceptUrl: string;
  organizationName: string;
}): Promise<void> {
  logger.info('tenant invitation', {
    to: options.to,
    organizationName: options.organizationName,
    acceptUrl: options.acceptUrl,
  });
}
