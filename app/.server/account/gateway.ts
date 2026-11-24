import type { Env } from "~/lib/env";
import type {
  AccountData,
  AccountSection,
  Device,
  DeviceType,
  Plan,
  Reward,
  Subscription,
} from "~/lib/account";

type Identity = { email: string; idToken: string };
type JsonObject = Record<string, unknown>;
export const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const list = (value: unknown) =>
  Array.isArray(value) ? value.map(object) : [];
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
const number = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
export class AccountServiceError extends Error {
  constructor(
    public reason:
      "failed" | "unavailable" | "invalid" | "forbidden" = "failed",
    public status = 502,
  ) {
    super(reason);
  }
}
function endpoint(base: string, path: string) {
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new AccountServiceError("unavailable");
  return `${url.href.replace(/\/$/, "")}/${path}`;
}
async function json(url: string, init: RequestInit) {
  try {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "SATELLAI-Headless/1.0");
    headers.set("Accept", "application/json");
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers,
    });
    if (!response.ok) throw new AccountServiceError("failed", response.status);
    const result = object(await response.json());
    if (
      (typeof result.code === "number" && result.code !== 200) ||
      result.error
    )
      throw new AccountServiceError("failed");
    return result;
  } catch (error) {
    if (error instanceof AccountServiceError) throw error;
    throw new AccountServiceError();
  }
}
export function accountSite(env: Env) {
  return env.ACCOUNT_SITE_KEY || "satellai-us";
}
export function accountCountry(env: Env) {
  return env.ACCOUNT_COUNTRY || "US";
}
export async function cms(
  env: Env,
  path: string,
  body: JsonObject,
  method = "POST",
) {
  if (!env.ACCOUNT_CMS_API_KEY) throw new AccountServiceError("unavailable");
  return json(
    endpoint(
      env.ACCOUNT_CMS_API_URL || "https://satellai-web.onrender.com/api/v2/web",
      path,
    ),
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin:
          env.ACCOUNT_CMS_ORIGIN ||
          `https://${env.COGNITO_LEGACY_STORE_DOMAIN || "satellai.com"}`,
        ...(method !== "POST" ? { "x-api-key": env.ACCOUNT_CMS_API_KEY } : {}),
      },
      body: JSON.stringify({
        ...body,
        ...(method === "POST" ? { apiKey: env.ACCOUNT_CMS_API_KEY } : {}),
      }),
    },
  );
}
export function safeCheckout(value: unknown, env: Env) {
  try {
    const url = new URL(text(value));
    const allowed = [
      "satellai.com",
      "www.satellai.com",
      "global.satellai.com",
      env.PUBLIC_STORE_DOMAIN,
      env.PUBLIC_CHECKOUT_DOMAIN,
      env.COGNITO_LEGACY_STORE_DOMAIN,
    ].filter(Boolean);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      allowed.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function normalizeSubscription(value: JsonObject, env: Env): Subscription {
  const quota = object(value.quota);
  const details = object(value.contractDetails);
  const sourceShopDomain = text(value.sourceShopDomain);
  const siteKey = text(value.siteKey) || accountSite(env);
  const id = text(value.subscriptionContractId);
  const store =
    siteKey === "satellai-global"
      ? "https://global.satellai.com"
      : siteKey === "satellai-us"
        ? "https://satellai.com"
        : null;
  return {
    id,
    title: text(details.title),
    type: text(value.productType)
      .toLowerCase()
      .replace(/^p(?=[dt]1$)/, ""),
    siteKey,
    sourceShopDomain,
    customerId: text(value.customerId),
    status: text(value.status || value.lifeTimeCardStatus),
    interval: text(value.billingPolicyIntervalText),
    price: text(value.priceText),
    nextBillingDate: text(value.nextBillingDate),
    used: number(quota.usedQuantity),
    total: number(quota.totalQuantity),
    quotaStatus: text(quota.status),
    devices: list(value.devices).map((item) => text(item.sncode)),
    isLifeTimeCard: value.isLifeTimeCard === true,
    expiresAt: text(value.expiresAt),
    manageUrl:
      value.isLifeTimeCard === true || !store
        ? null
        : `${store}/apps/subscriptions#/subscriptions/${encodeURIComponent(id.split("/").pop() || id)}/detail`,
  };
}
export function normalizeReward(value: JsonObject): Reward {
  const expiry = text(value.expiryDate || value.expiresAt);
  const status = text(value.status).toUpperCase();
  const expired =
    ["AVAILABLE", "PENDING"].includes(status) &&
    expiry &&
    Date.parse(expiry) < Date.now();
  return {
    code: text(value.code),
    status: expired ? "EXPIRED" : status,
    type: text(value.rewardType),
    productType: text(value.productType)
      .toLowerCase()
      .replace(/^p(?=[dt]1$)/, ""),
    months: number(value.rewardMonths),
    expiresAt: text(value.expiryDate || value.expiresAt),
    redeemedAt: text(value.redeemedAt),
  };
}
export async function loadAccountData(
  env: Env,
  identity: Identity,
): Promise<AccountData> {
  const goBase =
    env.ACCOUNT_DEVICE_API_URL || "https://api.satellai.com/go/prod/api/v1";
  const [goT1, goD1, subscriptions, rewards] = await Promise.allSettled([
    ...(["t1", "d1"] as const).map(async (type) => {
      const result = await json(endpoint(goBase, "users/query-by-email"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${identity.idToken}`,
          "Content-Type": "application/json",
          "X-Client-App": type,
        },
      });
      if (!Array.isArray(object(result.data || result).users))
        throw new AccountServiceError();
      return result;
    }),
    cms(env, "subscriptions-by-customer", {
      siteKey: accountSite(env),
      email: identity.email,
    }),
    cms(env, "redemption/my-codes", {
      siteKey: accountSite(env),
      email: identity.email,
    }),
  ]);
  const deviceMap = new Map<string, Device>();
  for (const [index, result] of [goT1, goD1].entries()) {
    if (result.status !== "fulfilled") continue;
    const payload = object(result.value.data || result.value);
    for (const user of list(payload.users))
      for (const value of list(user.devices)) {
        const sn = text(value.sn);
        const kind = text(value.device_type).toLowerCase();
        if (!sn || deviceMap.has(sn)) continue;
        const type: DeviceType =
          kind === "s1"
            ? "s1"
            : kind === "d1"
              ? "d1"
              : kind === "t1"
                ? "t1"
                : index === 0
                  ? "t1"
                  : "d1";
        deviceMap.set(sn, {
          sn,
          type,
          name: text(value.petName) || sn,
          contractId: text(value.subscriptionContractId) || null,
          siteKey: accountSite(env),
          isLifeTimeCard: false,
          isBundled: false,
          originalOwner: null,
          hasPurchased: false,
          trialTitle: "",
          trialCheckout: null,
          expiresAt: "",
          entitlementLoaded: false,
        });
      }
  }
  const devices = [...deviceMap.values()];
  const trialResults = await Promise.allSettled(
    (["d1", "t1", "s1"] as const)
      .filter((type) => devices.some((item) => item.type === type))
      .map((type) =>
        cms(env, "trial-eligibility", {
          siteKey: accountSite(env),
          sncodes: devices
            .filter((item) => item.type === type)
            .map((item) => item.sn),
          productType: type,
          appUser: identity.email,
          countryCode: accountCountry(env),
        }),
      ),
  );
  for (const result of trialResults) {
    if (result.status !== "fulfilled") continue;
    for (const value of list(result.value.results)) {
      const device = deviceMap.get(text(value.sncode));
      if (!device) continue;
      Object.assign(device, {
        contractId: text(value.subscriptionContractId) || device.contractId,
        siteKey: text(value.siteKey) || device.siteKey,
        isLifeTimeCard: value.isLifeTimeCard === true,
        isBundled: value.isBundled === true,
        originalOwner:
          typeof value.isOriginalOwner === "boolean"
            ? value.isOriginalOwner
            : null,
        hasPurchased: value.hasPurchased === true,
        trialTitle: text(value.title),
        trialCheckout: safeCheckout(value.checkoutUrl, env),
        expiresAt: text(value.expiresAt),
        entitlementLoaded: true,
      });
    }
  }
  function section<T>(
    result: PromiseSettledResult<JsonObject>,
    name: string,
    normalize: (value: JsonObject) => T,
  ): AccountSection<T> {
    if (result.status === "rejected")
      return {
        state:
          result.reason instanceof AccountServiceError &&
          result.reason.reason === "unavailable"
            ? "unavailable"
            : "error",
        items: [],
      };
    const items = object(result.value.data)[name];
    return Array.isArray(items)
      ? { state: "ready", items: list(items).map(normalize) }
      : { state: "error", items: [] };
  }
  return {
    devices: {
      state:
        goT1.status === "fulfilled" && goD1.status === "fulfilled"
          ? "ready"
          : "error",
      items: devices,
    },
    subscriptions: section(subscriptions, "subscriptions", (item) =>
      normalizeSubscription(item, env),
    ),
    rewards: section(rewards, "codes", normalizeReward),
    customerId:
      subscriptions.status === "fulfilled"
        ? text(object(subscriptions.value.data).customerId)
        : "",
  };
}
export async function loadPlans(
  env: Env,
  identity: Identity,
  device: Device,
): Promise<Plan[]> {
  const result = await cms(env, "packages-by-sncode", {
    siteKey: accountSite(env),
    sncode: device.sn,
    productType: device.type,
    appUser: identity.email,
    countryCode: accountCountry(env),
  });
  if (!Array.isArray(object(result.data).plans))
    throw new AccountServiceError();
  return list(object(result.data).plans).map((item) => ({
    id: text(item.variantId),
    title: text(item.title),
    interval: text(item.frequencyName),
    price: text(item.price),
    currency: text(item.currency),
    checkoutUrl: safeCheckout(item.checkoutUrl, env),
    tier: text(item.subscriptionTier),
  }));
}
