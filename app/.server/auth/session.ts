import type { Env } from "~/lib/env";
import type { AuthEvent } from "~/lib/auth/contracts";
import { AuthFailure } from "./cognito";

type CognitoSession = {
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: number;
};
const encoder = new TextEncoder();
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (char) => char.charCodeAt(0),
  );
}
export function requireSessionSecret(env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new AuthFailure("session");
  return env.SESSION_SECRET;
}
async function key(env: Env) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`satellai-cognito-v1:${requireSessionSecret(env)}`),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
function secure(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  )
    return false;
  throw new AuthFailure("session");
}
export function assertAuthSession(request: Request, env: Env) {
  requireSessionSecret(env);
  secure(request);
}
function name(request: Request, purpose: string) {
  return `${secure(request) ? "__Host-" : ""}satellai-${purpose}`;
}
function cookie(
  request: Request,
  purpose: string,
  value: string,
  maxAge: number,
) {
  return `${name(request, purpose)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(request) ? "; Secure" : ""}`;
}
async function seal(
  request: Request,
  env: Env,
  purpose: string,
  value: unknown,
  maxAge: number,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
    await key(env),
    encoder.encode(JSON.stringify(value)),
  );
  const serialized = `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
  if (serialized.length > 3600) throw new AuthFailure("session");
  return cookie(request, purpose, serialized, maxAge);
}
async function open<T>(
  request: Request,
  env: Env,
  purpose: string,
): Promise<T | null> {
  try {
    const value = request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${name(request, purpose)}=`))
      ?.split("=")[1];
    if (!value || value.length > 3600) return null;
    const [iv, ciphertext, extra] = value.split(".");
    if (!iv || !ciphertext || extra) return null;
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(iv),
        additionalData: encoder.encode(purpose),
      },
      await key(env),
      decode(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch {
    return null;
  }
}
export async function createCognitoSession(
  request: Request,
  env: Env,
  idToken: string,
) {
  // Only consume tokens received directly from the trusted authentication proxy.
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(
      new TextDecoder().decode(decode(idToken.split(".")[1])),
    );
  } catch {
    throw new AuthFailure("session");
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.email !== "string" ||
    !claims.sub ||
    claims.token_use !== "id"
  )
    throw new AuthFailure("session");
  const maxAge = Math.min(claims.exp - now, 3600);
  return seal(
    request,
    env,
    "cognito",
    {
      idToken,
      email: claims.email,
      firstName:
        typeof claims.given_name === "string"
          ? claims.given_name
          : typeof claims["custom:firstName"] === "string"
            ? claims["custom:firstName"]
            : "",
      lastName:
        typeof claims.family_name === "string"
          ? claims.family_name
          : typeof claims["custom:lastName"] === "string"
            ? claims["custom:lastName"]
            : "",
      expiresAt: now + maxAge,
    } satisfies CognitoSession,
    maxAge,
  );
}
export async function readCognitoSession(request: Request, env: Env) {
  const session = await open<CognitoSession>(request, env, "cognito");
  return session && session.expiresAt > Date.now() / 1000 ? session : null;
}
export function clearCognitoSession(request: Request) {
  return cookie(request, "cognito", "", 0);
}
export function createAuthEvent(
  request: Request,
  env: Env,
  event: AuthEvent["name"],
) {
  return seal(
    request,
    env,
    "auth-event",
    { name: event, id: crypto.randomUUID(), expiresAt: Date.now() + 120000 },
    120,
  );
}
export async function readAuthEvent(request: Request, env: Env) {
  const event = await open<AuthEvent & { expiresAt: number }>(
    request,
    env,
    "auth-event",
  );
  return event &&
    event.expiresAt > Date.now() &&
    (event.name === "login" || event.name === "sign_up")
    ? { name: event.name, id: event.id }
    : null;
}
export function clearAuthEvent(request: Request) {
  return cookie(request, "auth-event", "", 0);
}
export function createPendingEmail(request: Request, env: Env, email: string) {
  return seal(
    request,
    env,
    "verify-email",
    { email, expiresAt: Date.now() + 3600000 },
    3600,
  );
}
export async function readPendingEmail(request: Request, env: Env) {
  const pending = await open<{ email: string; expiresAt: number }>(
    request,
    env,
    "verify-email",
  );
  return pending && pending.expiresAt > Date.now() ? pending.email : "";
}
export function clearPendingEmail(request: Request) {
  return cookie(request, "verify-email", "", 0);
}
export function createResetEmail(request: Request, env: Env, email: string) {
  return seal(
    request,
    env,
    "reset-email",
    { email, expiresAt: Date.now() + 3600000 },
    3600,
  );
}
export async function readResetEmail(request: Request, env: Env) {
  const pending = await open<{ email: string; expiresAt: number }>(
    request,
    env,
    "reset-email",
  );
  return pending && pending.expiresAt > Date.now() ? pending.email : "";
}
export function clearResetEmail(request: Request) {
  return cookie(request, "reset-email", "", 0);
}
export function createResetNotice(request: Request, env: Env) {
  return seal(
    request,
    env,
    "reset-notice",
    { expiresAt: Date.now() + 120000 },
    120,
  );
}
export async function readResetNotice(request: Request, env: Env) {
  const notice = await open<{ expiresAt: number }>(
    request,
    env,
    "reset-notice",
  );
  return !!notice && notice.expiresAt > Date.now();
}
export function clearResetNotice(request: Request) {
  return cookie(request, "reset-notice", "", 0);
}
export function createShopifySession(
  request: Request,
  env: Env,
  token: string,
  expiresAt: string,
) {
  const maxAge = Math.min(
    3600,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  );
  if (!Number.isFinite(maxAge) || maxAge <= 0) throw new AuthFailure("session");
  return seal(
    request,
    env,
    "shopify-account",
    { token, expiresAt: Date.now() + maxAge * 1000 },
    maxAge,
  );
}
export async function readShopifySession(request: Request, env: Env) {
  const session = await open<{ token: string; expiresAt: number }>(
    request,
    env,
    "shopify-account",
  );
  return session && session.expiresAt > Date.now() ? session : null;
}
export function clearShopifySession(request: Request) {
  return cookie(request, "shopify-account", "", 0);
}
