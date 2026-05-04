import { assertPasswordPolicy, PasswordPolicyError } from './passwordPolicy';

describe('assertPasswordPolicy', () => {
  it('accepts a strong password', () => {
    expect(() => assertPasswordPolicy('CorrectHorseBattery99!')).not.toThrow();
  });

  it('rejects short password', () => {
    expect(() => assertPasswordPolicy('short1!A')).toThrow(PasswordPolicyError);
  });

  it('rejects missing special character', () => {
    expect(() => assertPasswordPolicy('NoSpecialChar99Aa')).toThrow(PasswordPolicyError);
  });
});
