// Browser-safe contracts only; server credentials and handlers are never barrel exports.
export { isValidEmail, isValidPassword } from "./contracts";
export type { AuthError, AuthEvent, AuthResult } from "./contracts";
