import { CUSTOMER_LOGOUT } from "~/graphql/account/storefront-account";
import { storefrontClientContext } from "~/.server/shopify/storefront";
import { envContext } from "~/lib/env";
import { redirect } from "react-router";
import { assertSameOriginPost } from "~/.server/auth/actions";
import {
  clearAuthEvent,
  clearCognitoSession,
  clearPendingEmail,
  clearShopifySession,
  readShopifySession,
} from "~/.server/auth/session";
import type { Route } from "./+types/logout";
export function loader() {
  return redirect("/account");
}
export async function action({ request, context }: Route.ActionArgs) {
  try {
    assertSameOriginPost(request);
  } catch {
    return new Response(null, { status: 403 });
  }
  if (context) {
    const session = await readShopifySession(request, context.get(envContext));
    const storefront = context.get(storefrontClientContext);
    if (session && storefront)
      context.waitUntil(
        storefront
          .graphql(CUSTOMER_LOGOUT, { variables: { token: session.token } })
          .then(() => undefined)
          .catch(() => undefined),
      );
  }
  const headers = new Headers();
  headers.append("Set-Cookie", clearCognitoSession(request));
  headers.append("Set-Cookie", clearAuthEvent(request));
  headers.append("Set-Cookie", clearPendingEmail(request));
  headers.append("Set-Cookie", clearShopifySession(request));
  return redirect("/account/login", { status: 303, headers });
}
