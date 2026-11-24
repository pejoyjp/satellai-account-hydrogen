import type { Env } from "~/lib/env";
import { ORDERS_PAGE_SIZE } from "~/lib/account/types";
import type { RequestStorefrontClient } from "~/.server/shopify/storefront";
import {
  MULTIPASS_LOGIN,
  CUSTOMER_DASHBOARD,
} from "~/graphql/account/storefront-account";
import {
  readShopifySession,
  createShopifySession,
} from "~/.server/auth/session";

/** Exchange only the original store's fresh Multipass URL, never an arbitrary redirect. */
export async function connectShopify(
  request: Request,
  env: Env,
  client: RequestStorefrontClient,
  result: string | undefined,
) {
  if (!result) return null;
  try {
    const url = new URL(result);
    const domain = env.COGNITO_LEGACY_STORE_DOMAIN || "satellai.com";
    if (
      url.protocol !== "https:" ||
      url.hostname !== domain ||
      url.username ||
      url.password
    )
      return null;
    const match = url.pathname.match(/^\/account\/login\/multipass\/([^/]+)$/);
    if (!match) return null;
    const { data, errors } = await client.graphql(MULTIPASS_LOGIN, {
      variables: { token: decodeURIComponent(match[1]) },
    });
    const token =
      data?.customerAccessTokenCreateWithMultipass?.customerAccessToken;
    if (errors?.length || !token) return null;
    return await createShopifySession(
      request,
      env,
      token.accessToken,
      token.expiresAt,
    );
  } catch {
    return null;
  }
}
export async function loadCommerce(
  request: Request,
  env: Env,
  client: RequestStorefrontClient | undefined,
) {
  if (!client) return { state: "unavailable", customer: null } as const;
  const session = await readShopifySession(request, env);
  if (!session) return { state: "unavailable", customer: null } as const;
  try {
    const search = new URL(request.url).searchParams;
    const after = search.get("after")?.slice(0, 1000) || undefined;
    const before = search.get("before")?.slice(0, 1000) || undefined;
    /** Cursors cannot be computed, so the last page is requested explicitly. */
    const wantsLastPage =
      !after && !before && search.get("page") === "last";
    const query = (variables: {
      first?: number;
      after?: string;
      last?: number;
      before?: string;
    }) =>
      client.graphql(CUSTOMER_DASHBOARD, {
        variables: { token: session.token, ...variables },
      });
    let result = wantsLastPage
      ? await query({ last: ORDERS_PAGE_SIZE })
      : after || !before
        ? await query({ first: ORDERS_PAGE_SIZE, after })
        : await query({ last: ORDERS_PAGE_SIZE, before });
    if (wantsLastPage) {
      // The final slice only lines up with 10-item page boundaries when the
      // total is a multiple of the page size; otherwise fetch the remainder.
      const orders = result.data?.customer?.orders;
      const total = Number(orders?.totalCount ?? 0);
      const remainder = total % ORDERS_PAGE_SIZE || ORDERS_PAGE_SIZE;
      if (
        !result.errors?.length &&
        orders &&
        total > ORDERS_PAGE_SIZE &&
        remainder !== ORDERS_PAGE_SIZE
      ) {
        result = await query({ last: remainder });
      }
    }
    const { data, errors } = result;
    if (errors?.length || !data?.customer)
      return { state: "error", customer: null } as const;
    return { state: "ready", customer: data.customer } as const;
  } catch {
    return { state: "error", customer: null } as const;
  }
}
