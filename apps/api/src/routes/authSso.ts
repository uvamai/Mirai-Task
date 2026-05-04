import { Router } from 'express';
import { env } from '../config/env';

export const authSsoRouter = Router();

/**
 * Enterprise SSO readiness probe. Full SAML ACS / OIDC callback flows are not wired in this build;
 * extend with @node-saml/node-saml or an OIDC client when IdP metadata and redirect URLs are finalized.
 */
authSsoRouter.get('/auth/sso/status', (_req, res) => {
  const samlConfigured = Boolean(
    process.env.SAML_ENTRY_POINT && process.env.SAML_ISSUER && process.env.SAML_IDP_CERT
  );
  const oidcConfigured = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
  res.json({
    samlConfigured,
    oidcConfigured,
    message:
      samlConfigured || oidcConfigured
        ? 'SSO environment variables are partially set; interactive login flows are not enabled in this scaffold.'
        : 'Set SAML_* or OIDC_ISSUER + OIDC_CLIENT_ID (+ OIDC_CLIENT_SECRET) to prepare enterprise SSO (see docs).',
    billingMode: env.billingMode,
    endpoints: {
      samlAcs: '/auth/saml/acs (not implemented)',
      oidcCallback: '/auth/oidc/callback (not implemented)',
    },
  });
});
