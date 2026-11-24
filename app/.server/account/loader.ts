import { data, redirect } from "react-router";
import type { Env } from "~/lib/env";
import {
  clearAuthEvent,
  readAuthEvent,
  readCognitoSession,
} from "~/.server/auth/session";
import type { RequestStorefrontClient } from "~/.server/shopify/storefront";
import { DEFAULT_LOCALE, loadTranslations } from "~/i18n/resources";
import { loadAccountData } from "./gateway";
import { loadCommerce } from "./shopify";
export async function loadDashboard(
  request: Request,
  env: Env,
  client: RequestStorefrontClient | undefined,
) {
  const identity = await readCognitoSession(request, env);
  if (!identity) return redirect("/account/login");
  const [account, commerce, translations, event] = await Promise.all([
    loadAccountData(env, identity),
    loadCommerce(request, env, client),
    loadTranslations(DEFAULT_LOCALE, "account"),
    readAuthEvent(request, env),
  ]);
  const verifiedCommerce =
    commerce.customer &&
    commerce.customer.email?.toLowerCase() !== identity.email.toLowerCase()
      ? { state: "error" as const, customer: null }
      : commerce;
  const headers = new Headers();
  if (event) headers.append("Set-Cookie", clearAuthEvent(request));
  return data(
    {
      account,
      commerce: verifiedCommerce,
      profile: {
        email: identity.email,
        firstName: verifiedCommerce.customer?.firstName || identity.firstName,
        lastName: verifiedCommerce.customer?.lastName || identity.lastName,
      },
      translations,
      event,
    },
    { headers },
  );
}
