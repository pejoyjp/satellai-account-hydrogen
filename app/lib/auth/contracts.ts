export const PASSWORD_PATTERN = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`=+-]/;
export function isValidPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 256 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    PASSWORD_PATTERN.test(value)
  );
}
export function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export type AuthError =
  | "required"
  | "email"
  | "password"
  | "passwordMismatch"
  | "resetSession"
  | "consent"
  | "credentials"
  | "exists"
  | "code"
  | "expired"
  | "rate"
  | "unavailable"
  | "newPassword"
  | "session"
  | "request";
export type AuthResult = {
  error?: AuthError;
  field?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  purchaseRegion?: string;
  purchaseChannel?: string;
  resent?: number;
};
export type AuthEvent = { name: "login" | "sign_up"; id: string };
