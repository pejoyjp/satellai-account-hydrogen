import {
  createShopifyRequestContext,
  createStorefrontClient,
  defineShopifyI18n,
  type RequestScopedPrivateStorefrontClient,
} from "@shopify/hydrogen";
import { createContext } from "react-router";
import type { Env } from "~/lib/env";

const i18n = defineShopifyI18n({
  defaultLocale: { country: "US", language: "EN" },
});

export type RequestStorefrontClient = RequestScopedPrivateStorefrontClient;

export const storefrontClientContext = createContext<
  RequestStorefrontClient | undefined
>(undefined);

export function createRequestStorefrontClient(request: Request, env: Env) {
  if (!env.PUBLIC_STORE_DOMAIN || !env.PRIVATE_STOREFRONT_API_TOKEN) return;

  const buyerIp =
    request.headers.get("oxygen-buyer-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!buyerIp && process.env.NODE_ENV === "production") return;

  return createStorefrontClient({
    type: "private",
    requestContext: createShopifyRequestContext({
      request,
      i18n,
      buyerIp: buyerIp || "127.0.0.1",
    }),
    config: {
      storeDomain: env.PUBLIC_STORE_DOMAIN,
      privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
    },
  });
}
