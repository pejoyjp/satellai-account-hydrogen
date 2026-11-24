import type { ResultOf } from "gql.tada";
import type { CUSTOMER_DASHBOARD } from "~/graphql/account/storefront-account";
export type CommerceCustomer = NonNullable<
  ResultOf<typeof CUSTOMER_DASHBOARD>["customer"]
>;
/** Shopify customer orders are cursor paginated; this is the fixed slice size. */
export const ORDERS_PAGE_SIZE = 10;
export type CommerceData = {
  state: "ready" | "error" | "unavailable";
  customer: CommerceCustomer | null;
};
export type DeviceType = "d1" | "t1" | "s1";
export type Device = {
  sn: string;
  type: DeviceType;
  name: string;
  contractId: string | null;
  siteKey: string;
  isLifeTimeCard: boolean;
  isBundled: boolean;
  originalOwner: boolean | null;
  hasPurchased: boolean;
  trialTitle: string;
  trialCheckout: string | null;
  expiresAt: string;
  entitlementLoaded: boolean;
};
export type Subscription = {
  id: string;
  title: string;
  type: string;
  siteKey: string;
  sourceShopDomain: string;
  customerId: string;
  status: string;
  interval: string;
  price: string;
  nextBillingDate: string;
  used: number;
  total: number;
  quotaStatus: string;
  devices: string[];
  isLifeTimeCard: boolean;
  expiresAt: string;
  manageUrl: string | null;
};
export type Reward = {
  code: string;
  status: string;
  type: string;
  productType: string;
  months: number;
  expiresAt: string;
  redeemedAt: string;
};
export type AccountSection<T> = {
  state: "ready" | "error" | "unavailable";
  items: T[];
};
export type AccountData = {
  devices: AccountSection<Device>;
  subscriptions: AccountSection<Subscription>;
  rewards: AccountSection<Reward>;
  customerId: string;
};
export type Plan = {
  id: string;
  title: string;
  interval: string;
  price: string;
  currency: string;
  checkoutUrl: string | null;
  tier: string;
};
export type AccountActionResult = {
  ok: boolean;
  intent: string;
  error?: "failed" | "forbidden" | "unavailable" | "invalid" | "expired";
  plans?: Plan[];
  reward?: Reward;
  checkoutUrl?: string;
};
