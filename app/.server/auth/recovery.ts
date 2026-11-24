import { redirect } from "react-router";
import type { Env } from "~/lib/env";
import { isValidPassword } from "~/lib/auth";
import { emailFrom, errorResponse, readAuthForm } from "./actions";
import { AuthFailure, callCognito } from "./cognito";
import {
  assertAuthSession,
  clearAuthEvent,
  clearCognitoSession,
  clearResetEmail,
  clearShopifySession,
  createResetEmail,
  createResetNotice,
  readResetEmail,
} from "./session";

export async function requestPasswordReset(request: Request, env: Env) {
  let email: string | undefined;
  try {
    const form = await readAuthForm(request);
    email = emailFrom(form);
    assertAuthSession(request, env);
    await callCognito(env, "request-reset", { email });
    return redirect("/account/reset-password", {
      status: 303,
      headers: { "Set-Cookie": await createResetEmail(request, env, email) },
    });
  } catch (error) {
    return errorResponse(error, { email });
  }
}

export async function confirmPasswordReset(request: Request, env: Env) {
  try {
    const form = await readAuthForm(request);
    assertAuthSession(request, env);
    const email = await readResetEmail(request, env);
    if (!email) throw new AuthFailure("resetSession");
    const code = (form.get("code") || "").trim();
    const newPassword = form.get("newPassword") || "";
    if (!code || code.length > 64) throw new AuthFailure("code", "code");
    if (!isValidPassword(newPassword))
      throw new AuthFailure("password", "password");
    if (newPassword !== form.get("confirmPassword"))
      throw new AuthFailure("passwordMismatch", "confirmPassword");
    await callCognito(env, "confirm-reset", { email, code, newPassword });
    const headers = new Headers();
    headers.append("Set-Cookie", clearResetEmail(request));
    headers.append("Set-Cookie", clearCognitoSession(request));
    headers.append("Set-Cookie", clearShopifySession(request));
    headers.append("Set-Cookie", clearAuthEvent(request));
    headers.append("Set-Cookie", await createResetNotice(request, env));
    return redirect("/account/login", { status: 303, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
