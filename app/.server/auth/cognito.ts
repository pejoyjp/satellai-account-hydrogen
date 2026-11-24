import type { Env } from "~/lib/env";
import type { AuthError } from "~/lib/auth/contracts";

type Operation =
  | "sign-up"
  | "confirm-sign-up"
  | "resend-confirmation"
  | "login"
  | "request-reset"
  | "confirm-reset";
type ApiResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  field?: string;
  unconfirmed?: boolean;
  requiresNewPassword?: boolean;
  tokens?: { idToken?: string };
  result?: string;
};
export class AuthFailure extends Error {
  constructor(
    public reason: AuthError,
    public field?: string,
    public unconfirmed = false,
  ) {
    super(reason);
  }
}

/** The existing authentication proxy owns Cognito credentials and verification. */
export async function callCognito(
  env: Env,
  operation: Operation,
  payload: Record<string, string>,
) {
  const base = new URL(
    env.COGNITO_AUTH_API_URL ||
      "https://dqwt0ur9vdw78.cloudfront.net/sales/auth",
  );
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new AuthFailure("unavailable");
  let response: Response;
  let body: ApiResponse;
  try {
    response = await fetch(`${base.href.replace(/\/$/, "")}/${operation}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // The existing CloudFront distribution rejects requests without an agent.
        "User-Agent": "SATELLAI-Headless/1.0",
      },
      body: JSON.stringify(payload),
      // Workers reject redirect: "error" before sending the request.
      // Inspect redirects ourselves and never forward credentials to a new URL.
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status >= 300 && response.status < 400)
      throw new AuthFailure("unavailable");
    body = (await response.json()) as ApiResponse;
    if (!body || typeof body !== "object") throw new Error("Invalid response");
  } catch {
    throw new AuthFailure("unavailable");
  }
  if (!response.ok || body.success !== true) {
    const code = `${body.code || ""} ${body.message || ""}`;
    const unconfirmed =
      body.unconfirmed === true ||
      /UserNotConfirmed|unconfirmed|not confirmed|not yet confirmed/i.test(
        code,
      );
    const resetIneligible =
      unconfirmed ||
      /UserNotFound|user (?:does not exist|not found|is disabled)|account (?:not found|is disabled)|no registered\/verified email/i.test(
        code,
      );
    let reason: AuthError = "unavailable";
    if (
      response.status === 429 ||
      /TooMany|LimitExceeded|rate|attempts exceeded/i.test(code)
    )
      reason = "rate";
    else if (/UsernameExists|already exists/i.test(code)) reason = "exists";
    else if (/CodeMismatch|invalid.*code/i.test(code)) reason = "code";
    else if (/ExpiredCode/i.test(code)) reason = "expired";
    else if (/InvalidPassword/i.test(code)) reason = "password";
    else if (
      operation === "request-reset" &&
      response.status < 500 &&
      resetIneligible
    )
      return { success: true };
    else if (
      operation === "confirm-reset" &&
      response.status < 500 &&
      resetIneligible
    )
      reason = "code";
    else if (operation === "login" && response.status < 500)
      reason = "credentials";
    else if (
      body.field === "purchaseRegion" ||
      body.field === "purchaseChannel"
    )
      reason = "request";
    throw new AuthFailure(reason, body.field, unconfirmed);
  }
  return body;
}
