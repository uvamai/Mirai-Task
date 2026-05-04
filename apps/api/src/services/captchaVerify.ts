import { env } from '../config/env';
import { logger } from '../logger';

type SiteverifyBody = Record<string, string>;

async function postForm(url: string, body: SiteverifyBody): Promise<{ success?: boolean }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!r.ok) {
    logger.warn('captcha siteverify http error', { status: r.status, url });
    return { success: false };
  }
  return (await r.json()) as { success?: boolean };
}

/**
 * When no captcha secret is configured, verification is skipped (development).
 * When a secret is set, `token` must be present and pass the provider check.
 */
export async function verifyCaptchaIfConfigured(token: string | undefined): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (env.turnstileSecretKey) {
    if (!token?.trim()) return { ok: false, reason: 'Captcha required' };
    const j = await postForm('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      secret: env.turnstileSecretKey,
      response: token.trim(),
    });
    return j.success ? { ok: true } : { ok: false, reason: 'Captcha verification failed' };
  }
  if (env.hcaptchaSecretKey) {
    if (!token?.trim()) return { ok: false, reason: 'Captcha required' };
    const j = await postForm('https://hcaptcha.com/siteverify', {
      secret: env.hcaptchaSecretKey,
      response: token.trim(),
    });
    return j.success ? { ok: true } : { ok: false, reason: 'Captcha verification failed' };
  }
  if (env.recaptchaSecretKey) {
    if (!token?.trim()) return { ok: false, reason: 'Captcha required' };
    const j = await postForm('https://www.google.com/recaptcha/api/siteverify', {
      secret: env.recaptchaSecretKey,
      response: token.trim(),
    });
    return j.success ? { ok: true } : { ok: false, reason: 'Captcha verification failed' };
  }
  return { ok: true };
}
