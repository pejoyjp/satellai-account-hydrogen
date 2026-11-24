import { AuthFailure } from "~/.server/auth/cognito";
import { data, redirect } from "react-router";
import type { Env } from "~/lib/env";
import { readAuthForm } from "~/.server/auth/actions";
import { readCognitoSession, readShopifySession } from "~/.server/auth/session";
import type { RequestStorefrontClient } from "~/.server/shopify/storefront";
import {
  ADDRESS_CREATE,
  ADDRESS_UPDATE,
  ADDRESS_DELETE,
  ADDRESS_DEFAULT,
  CUSTOMER_UPDATE,
} from "~/graphql/account/storefront-account";
import {
  canBind,
  canUnbind,
  canPurchase,
  ownedSubscription,
  type AccountActionResult,
} from "~/lib/account";
import {
  AccountServiceError,
  accountCountry,
  accountSite,
  cms,
  loadAccountData,
  loadPlans,
  normalizeReward,
  object,
  safeCheckout,
} from "./gateway";
import { loadCommerce } from "./shopify";

export async function accountAction(
  request: Request,
  env: Env,
  client: RequestStorefrontClient | undefined,
) {
  const identity = await readCognitoSession(request, env);
  if (!identity) return redirect("/account/login");
  let intent = "";
  try {
    const form = await readAuthForm(request);
    intent = form.get("intent") || "";
    if (
      ![
        "profile",
        "address-create",
        "address-update",
        "address-delete",
        "address-default",
        "reward-check",
        "reward-redeem",
        "plans",
        "bind",
        "unbind",
      ].includes(intent)
    )
      throw new AccountServiceError("invalid");
    const required = (key: string) => {
      const value = (form.get(key) || "").trim();
      if (!value || value.length > 512)
        throw new AccountServiceError("invalid");
      return value;
    };
    if (intent === "profile" || intent.startsWith("address-")) {
      const session = await readShopifySession(request, env);
      if (!session || !client) throw new AccountServiceError("unavailable");
      const commerce = await loadCommerce(request, env, client);
      if (
        !commerce.customer ||
        commerce.customer.email?.toLowerCase() !== identity.email.toLowerCase()
      )
        throw new AccountServiceError("forbidden");
      const id = form.get("id") || "";
      if (
        intent !== "address-create" &&
        intent !== "profile" &&
        !commerce.customer.addresses.nodes.some((item) => item.id === id)
      )
        throw new AccountServiceError("forbidden");
      let errors: readonly unknown[] = [];
      if (intent === "profile") {
        const result = await client.graphql(CUSTOMER_UPDATE, {
          variables: {
            token: session.token,
            customer: {
              firstName: required("firstName"),
              lastName: required("lastName"),
              phone: (form.get("phone") || "").trim() || null,
            },
          },
        });
        errors = [
          ...(result.errors || []),
          ...(result.data?.customerUpdate?.customerUserErrors || []),
        ];
        if (!result.data?.customerUpdate?.customer)
          throw new AccountServiceError();
      } else if (intent === "address-delete") {
        const result = await client.graphql(ADDRESS_DELETE, {
          variables: { token: session.token, id },
        });
        errors = [
          ...(result.errors || []),
          ...(result.data?.customerAddressDelete?.customerUserErrors || []),
        ];
        if (!result.data?.customerAddressDelete?.deletedCustomerAddressId)
          throw new AccountServiceError();
      } else if (intent === "address-default") {
        const result = await client.graphql(ADDRESS_DEFAULT, {
          variables: { token: session.token, id },
        });
        errors = [
          ...(result.errors || []),
          ...(result.data?.customerDefaultAddressUpdate?.customerUserErrors ||
            []),
        ];
        if (!result.data?.customerDefaultAddressUpdate?.customer)
          throw new AccountServiceError();
      } else if (intent === "address-create" || intent === "address-update") {
        const address = {
          firstName: required("firstName"),
          lastName: required("lastName"),
          address1: required("address1"),
          address2: form.get("address2") || "",
          company: form.get("company") || "",
          city: required("city"),
          province: form.get("province") || "",
          country: required("country"),
          zip: required("zip"),
          phone: form.get("phone") || "",
        };
        if (intent === "address-create") {
          const result = await client.graphql(ADDRESS_CREATE, {
            variables: { token: session.token, address },
          });
          errors = [
            ...(result.errors || []),
            ...(result.data?.customerAddressCreate?.customerUserErrors || []),
          ];
          if (!result.data?.customerAddressCreate?.customerAddress)
            throw new AccountServiceError();
        } else {
          const result = await client.graphql(ADDRESS_UPDATE, {
            variables: { token: session.token, id, address },
          });
          errors = [
            ...(result.errors || []),
            ...(result.data?.customerAddressUpdate?.customerUserErrors || []),
          ];
          if (!result.data?.customerAddressUpdate?.customerAddress)
            throw new AccountServiceError();
        }
      } else throw new AccountServiceError("invalid");
      if (errors.length) throw new AccountServiceError();
      return data<AccountActionResult>({ ok: true, intent });
    }
    if (intent === "reward-check") {
      const code = required("code").toUpperCase();
      const result = await cms(env, "redemption/check", {
        siteKey: accountSite(env),
        code,
      });
      return data<AccountActionResult>({
        ok: true,
        intent,
        reward: normalizeReward({
          ...object(result.data),
          code,
          status: "AVAILABLE",
        }),
      });
    }
    const snapshot = await loadAccountData(env, identity);
    const device = snapshot.devices.items.find(
      (item) => item.sn === required("sn"),
    );
    if (!device) throw new AccountServiceError("forbidden");
    if (intent === "plans") {
      if (!canPurchase(device)) throw new AccountServiceError("forbidden");
      return data<AccountActionResult>({
        ok: true,
        intent,
        plans: await loadPlans(env, identity, device),
      });
    }
    if (intent === "bind") {
      const subscription = ownedSubscription(
        snapshot.subscriptions.items,
        required("contractId"),
        required("siteKey"),
      );
      if (!subscription || !canBind(device, subscription))
        throw new AccountServiceError("forbidden");
      await cms(
        env,
        "device-binding",
        {
          sncode: device.sn,
          subscriptionContractId: subscription.id,
          siteKey: subscription.siteKey,
          customerId: subscription.isLifeTimeCard
            ? ""
            : subscription.customerId || snapshot.customerId,
          contactEmail: identity.email,
          shopifyUser: identity.email,
          sourceShopDomain: subscription.sourceShopDomain,
          channel: "manual",
          productType: device.type,
        },
        "PUT",
      );
    } else if (intent === "unbind") {
      if (!canUnbind(device, snapshot.subscriptions.items))
        throw new AccountServiceError("forbidden");
      await cms(
        env,
        "device-binding",
        {
          sncode: device.sn,
          subscriptionContractId: device.contractId,
          siteKey: device.siteKey,
          contactEmail: identity.email,
        },
        "DELETE",
      );
    } else if (intent === "reward-redeem") {
      const code = required("code").toUpperCase();
      const checked = await cms(env, "redemption/check", {
        siteKey: accountSite(env),
        code,
      });
      const reward = normalizeReward({ ...object(checked.data), code });
      if (reward.productType !== device.type)
        throw new AccountServiceError("forbidden");
      const body: Record<string, unknown> = {
        siteKey: accountSite(env),
        email: identity.email,
        code,
        sncode: device.sn,
        countryCode: accountCountry(env),
      };
      if (reward.type === "EXTEND_DURATION") {
        const subscription = ownedSubscription(
          snapshot.subscriptions.items,
          required("contractId"),
          required("siteKey"),
        );
        if (
          !subscription ||
          subscription.isLifeTimeCard ||
          subscription.status.toUpperCase() !== "ACTIVE" ||
          !subscription.devices.includes(device.sn)
        )
          throw new AccountServiceError("forbidden");
        body.targetSubscriptionId = subscription.id;
        body.targetSubscriptionSiteKey = subscription.siteKey;
      } else if (!canPurchase(device))
        throw new AccountServiceError("forbidden");
      const isListed =
        snapshot.rewards.state === "ready" &&
        snapshot.rewards.items.some((item) => item.code === code);
      const result = await cms(
        env,
        isListed ? "redemption/claim" : "redemption/add-manual",
        body,
      );
      if (reward.type !== "EXTEND_DURATION") {
        const url = safeCheckout(object(result.data).checkoutUrl, env);
        if (!url) throw new AccountServiceError();
        return data<AccountActionResult>({
          ok: true,
          intent,
          checkoutUrl: url,
        });
      }
    } else throw new AccountServiceError("invalid");
    return data<AccountActionResult>({ ok: true, intent });
  } catch (error) {
    if (error instanceof AuthFailure && error.reason === "request")
      return data<AccountActionResult>(
        { ok: false, intent, error: "forbidden" },
        { status: 403 },
      );
    return data<AccountActionResult>(
      {
        ok: false,
        intent,
        error: error instanceof AccountServiceError ? error.reason : "failed",
      },
      {
        status:
          error instanceof AccountServiceError && error.reason === "forbidden"
            ? 403
            : 400,
      },
    );
  }
}
