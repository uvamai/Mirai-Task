export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
    Object.setPrototypeOf(this, PasswordPolicyError.prototype);
  }
}

/** Min 12 chars; upper, lower, digit, special per PRD. */
export function assertPasswordPolicy(password: string): void {
  if (password.length < 12) {
    throw new PasswordPolicyError('Password must be at least 12 characters');
  }
  if (!/[a-z]/.test(password)) {
    throw new PasswordPolicyError('Password must include a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    throw new PasswordPolicyError('Password must include an uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new PasswordPolicyError('Password must include a digit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new PasswordPolicyError('Password must include a special character');
  }
}
