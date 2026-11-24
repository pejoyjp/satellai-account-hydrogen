import { data, redirect } from "react-router";
import type { Env } from "~/lib/env";
import { DEFAULT_LOCALE, loadTranslations } from "~/i18n/resources";
import {
  createPendingEmail,
  readPendingEmail,
  clearAuthEvent,
  readAuthEvent,
  readCognitoSession,
  readResetNotice,
  clearResetNotice,
  readResetEmail,
} from "./session";
export async function loadAuthPage(
  request: Request,
  env: Env,
  page: "login" | "register" | "verify" | "forgot-password" | "reset-password",
) {
  const url = new URL(request.url);
  if (
    (await readCognitoSession(request, env)) &&
    !(page === "login" && url.searchParams.get("reauth") === "1")
  )
    return redirect("/account");
  const email = (url.searchParams.get("email") || "").slice(0, 254);
  if (
    (page === "verify" ||
      (page === "register" && url.searchParams.has("unconfirmed"))) &&
    email
  )
    return redirect("/account/verify", {
      headers: { "Set-Cookie": await createPendingEmail(request, env, email) },
    });
  const event = page === "login" ? await readAuthEvent(request, env) : null;
  const passwordReset =
    page === "login" && (await readResetNotice(request, env));
  const resetEmail =
    page === "reset-password" || page === "forgot-password"
      ? await readResetEmail(request, env)
      : "";
  if (page === "reset-password" && !resetEmail)
    return redirect("/account/forgot-password");
  const headers = new Headers();
  if (event) headers.append("Set-Cookie", clearAuthEvent(request));
  if (passwordReset) headers.append("Set-Cookie", clearResetNotice(request));
  return data(
    {
      translations: await loadTranslations(DEFAULT_LOCALE, "account"),
      email:
        page === "verify" ? await readPendingEmail(request, env) : resetEmail,
      event,
      verified: event?.name === "sign_up",
      passwordReset,
    },
    { headers },
  );
}
