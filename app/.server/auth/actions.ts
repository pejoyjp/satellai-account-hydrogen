import type { RequestStorefrontClient } from "~/.server/shopify/storefront";
import { connectShopify } from "~/.server/account/shopify";
import { data, redirect } from "react-router";
import type { Env } from "~/lib/env";
import { AuthFailure, callCognito } from "./cognito";
import {
  isValidEmail,
  isValidPassword,
  type AuthResult,
} from "~/lib/auth/contracts";
import {
  clearPendingEmail,
  clearShopifySession,
  createPendingEmail,
  createAuthEvent,
  createCognitoSession,
  assertAuthSession,
} from "./session";

export function assertSameOriginPost(request: Request) {
  if (
    request.method !== "POST" ||
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AuthFailure("request");
}

export async function readAuthForm(request: Request) {
  assertSameOriginPost(request);
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    throw new AuthFailure("request");
  // Bound the stream before parsing, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new AuthFailure("request");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > 16384) {
        await reader.cancel();
        throw new AuthFailure("request");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}
export function errorResponse(error: unknown, values: AuthResult = {}) {
  const failure =
    error instanceof AuthFailure ? error : new AuthFailure("unavailable");
  return data<AuthResult>(
    {
      ...values,
      error: failure.reason,
      field: [
        "email",
        "password",
        "confirmPassword",
        "code",
        "purchaseRegion",
        "purchaseChannel",
      ].includes(failure.field || "")
        ? failure.field
        : undefined,
    },
    {
      status:
        failure.reason === "unavailable" || failure.reason === "session"
          ? 503
          : 400,
    },
  );
}
export function emailFrom(form: URLSearchParams) {
  const email = (form.get("email") || "").trim();
  if (!isValidEmail(email)) throw new AuthFailure("email", "email");
  return email;
}
async function verificationRedirect(request: Request, env: Env, email: string) {
  return redirect("/account/verify", {
    status: 303,
    headers: { "Set-Cookie": await createPendingEmail(request, env, email) },
  });
}
export async function register(request: Request, env: Env) {
  let values: AuthResult = {};
  try {
    const form = await readAuthForm(request);
    if (form.get("intent") === "next") throw new AuthFailure("request");
    const email = emailFrom(form);
    assertAuthSession(request, env);
    const firstName = (form.get("firstName") || "").trim();
    const lastName = (form.get("lastName") || "").trim();
    values = {
      email,
      firstName,
      lastName,
      purchaseRegion:
        form.get("intent") === "skip" ? "" : form.get("purchaseRegion") || "",
      purchaseChannel:
        form.get("intent") === "skip" ? "" : form.get("purchaseChannel") || "",
    };
    if (
      !firstName ||
      !lastName ||
      firstName.length > 100 ||
      lastName.length > 100
    )
      throw new AuthFailure("required");
    const password = form.get("password") || "";
    if (!isValidPassword(password))
      throw new AuthFailure("password", "password");
    if (form.get("ageConsent") !== "on" || form.get("termsConsent") !== "on")
      throw new AuthFailure("consent");
    const payload: Record<string, string> = {
      email,
      firstName,
      lastName,
      password,
    };
    const region = values.purchaseRegion!;
    const channel = values.purchaseChannel!;
    if (region && !["NA", "EU", "APAC"].includes(region))
      throw new AuthFailure("request", "purchaseRegion");
    const channels = [
      "official_website",
      "amazon",
      "tiktok",
      "walmart",
      "best_buy",
      "tractor_supply",
      "petco",
      "chewy",
      "cdiscount",
      "fressnapf",
      "fruugo",
      "fnac",
      "allegro",
      "other_retail_store",
      "gift",
      "other",
      "dont_remember",
    ];
    if (
      channel &&
      (!region ||
        !channels.includes(channel) ||
        (region === "APAC" && channel !== "official_website"))
    )
      throw new AuthFailure("request", "purchaseChannel");
    if (region) payload.purchaseRegion = region;
    if (channel) payload.purchaseChannel = channel;
    await callCognito(env, "sign-up", payload);
    return await verificationRedirect(request, env, email);
  } catch (error) {
    if (error instanceof AuthFailure && error.unconfirmed && values.email)
      return await verificationRedirect(request, env, values.email);
    return errorResponse(error, values);
  }
}
export async function verify(request: Request, env: Env) {
  let email: string | undefined;
  try {
    const form = await readAuthForm(request);
    email = emailFrom(form);
    assertAuthSession(request, env);
    if (form.get("intent") === "resend") {
      await callCognito(env, "resend-confirmation", { username: email });
      return data<AuthResult>({ email, resent: Date.now() });
    }
    const code = (form.get("code") || "").trim();
    if (!code || code.length > 64) throw new AuthFailure("code");
    await callCognito(env, "confirm-sign-up", { username: email, code });
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await createAuthEvent(request, env, "sign_up"),
    );
    headers.append("Set-Cookie", clearPendingEmail(request));
    return redirect("/account/login", { status: 303, headers });
  } catch (error) {
    return errorResponse(error, { email });
  }
}
export async function login(
  request: Request,
  env: Env,
  client?: RequestStorefrontClient,
) {
  let email: string | undefined;
  try {
    const form = await readAuthForm(request);
    email = emailFrom(form);
    assertAuthSession(request, env);
    const password = form.get("password") || "";
    if (!password || password.length > 256) throw new AuthFailure("required");
    const body = await callCognito(env, "login", {
      username: email,
      password,
      target_path: "/account",
      site_domain: env.COGNITO_LEGACY_STORE_DOMAIN || "satellai.com",
    });
    if (body.requiresNewPassword) throw new AuthFailure("newPassword");
    if (!body.tokens?.idToken) throw new AuthFailure("session");
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await createCognitoSession(request, env, body.tokens.idToken),
    );
    headers.append("Set-Cookie", await createAuthEvent(request, env, "login"));
    // A legacy Shopify redirect cannot establish a Hydrogen Customer Account session.
    const commerceCookie = client
      ? await connectShopify(request, env, client, body.result)
      : null;
    headers.append(
      "Set-Cookie",
      commerceCookie || clearShopifySession(request),
    );
    return redirect("/account", { status: 303, headers });
  } catch (error) {
    if (error instanceof AuthFailure && error.unconfirmed && email)
      return await verificationRedirect(request, env, email);
    return errorResponse(error, { email });
  }
}
