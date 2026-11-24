import type { Device, Subscription } from "./types";
export function ownedSubscription(
  subscriptions: Subscription[],
  id: string,
  siteKey: string,
) {
  return subscriptions.find(
    (item) =>
      item.id.split("/").pop() === id.split("/").pop() &&
      item.siteKey === siteKey,
  );
}
export function canUnbind(device: Device, subscriptions: Subscription[]) {
  if (!device.entitlementLoaded || !device.contractId) return false;
  if (device.isLifeTimeCard && device.originalOwner === false) return false;
  return (
    !!ownedSubscription(subscriptions, device.contractId, device.siteKey) ||
    (device.isLifeTimeCard && device.originalOwner === true)
  );
}
export function canBind(device: Device, subscription: Subscription) {
  return (
    device.entitlementLoaded &&
    !device.contractId &&
    !(device.isLifeTimeCard && device.isBundled) &&
    subscription.type === device.type &&
    subscription.quotaStatus === "active" &&
    subscription.total > subscription.used &&
    subscription.status.toUpperCase() !== "PAUSED"
  );
}
export function canPurchase(device: Device) {
  if (!device.entitlementLoaded || device.hasPurchased) return false;
  if (device.isLifeTimeCard && device.originalOwner === false) return true;
  return !device.contractId && !device.isBundled;
}
