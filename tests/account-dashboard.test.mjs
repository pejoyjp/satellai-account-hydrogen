import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const server = await createServer({
  configFile: false,
  resolve: {
    alias: { "~": fileURLToPath(new URL("../app", import.meta.url)) },
  },
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true },
  logLevel: "error",
});
const { accountAction } = await server.ssrLoadModule(
  "/app/.server/account/actions.ts",
);
const sessions = await server.ssrLoadModule("/app/.server/auth/session.ts");
const { loadAccountData, safeCheckout } = await server.ssrLoadModule(
  "/app/.server/account/gateway.ts",
);
const { connectShopify } = await server.ssrLoadModule(
  "/app/.server/account/shopify.ts",
);
const { canUnbind } = await server.ssrLoadModule("/app/lib/account/rules.ts");
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
const env = {
  SESSION_SECRET: "test-only-dashboard-session-secret-at-least-32",
  ACCOUNT_CMS_API_KEY: "test-key",
  ACCOUNT_CMS_API_URL: "https://cms.example.invalid/api/v2/web",
  PUBLIC_STORE_DOMAIN: "satellai.myshopify.com",
  PRIVATE_STOREFRONT_API_TOKEN: "test-storefront",
};
const email = "owner@example.invalid";
const claims = {
  sub: "owner",
  token_use: "id",
  email,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const idToken = `test.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test`;
const cookie = await sessions.createCognitoSession(
  new Request("https://store.example/account"),
  env,
  idToken,
);
function request(values, withSession = true) {
  return new Request("https://store.example/account", {
    method: "POST",
    headers: {
      Origin: "https://store.example",
      ...(withSession ? { Cookie: cookie.split(";")[0] } : {}),
    },
    body: new URLSearchParams(values),
  });
}
function mock({
  bound = false,
  lifetime = false,
  owner = true,
  failTrials = false,
  failGo = false,
  rewardType = "TELECOM_PLAN",
} = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ url, method: init.method, body, headers: init.headers });
    if (url.includes("query-by-email")) {
      if (failGo) return Response.json({}, { status: 503 });
      return Response.json({
        data: {
          users: [
            {
              devices:
                new Headers(init.headers).get("X-Client-App") === "d1"
                  ? [
                      {
                        sn: "OWN-SN",
                        device_type: "d1",
                        imei: "must-not-be-serialized",
                      },
                    ]
                  : [],
            },
          ],
        },
      });
    }
    if (url.endsWith("/subscriptions-by-customer"))
      return Response.json({
        code: 200,
        data: {
          customerId: "123",
          subscriptions: [
            {
              subscriptionContractId: "PLAN-1",
              siteKey: "satellai-us",
              customerId: "123",
              productType: "d1",
              status: "ACTIVE",
              contractDetails: { title: "Plan" },
              quota: {
                status: "active",
                usedQuantity: bound ? 1 : 0,
                totalQuantity: 2,
              },
              devices: bound ? [{ sncode: "OWN-SN" }] : [],
            },
          ],
        },
      });
    if (url.endsWith("/my-codes"))
      return Response.json({ code: 200, data: { codes: [] } });
    if (url.endsWith("/trial-eligibility"))
      return failTrials
        ? Response.json({}, { status: 503 })
        : Response.json({
            results: [
              {
                sncode: "OWN-SN",
                subscriptionContractId: bound ? "PLAN-1" : null,
                siteKey: "satellai-us",
                isLifeTimeCard: lifetime,
                isBundled: bound,
                isOriginalOwner: owner,
                hasPurchased: bound,
              },
            ],
          });
    if (url.endsWith("/check"))
      return Response.json({
        code: 200,
        data: { productType: "d1", rewardType },
      });
    if (url.endsWith("/packages-by-sncode"))
      return Response.json({
        data: {
          plans: [
            {
              variantId: "1",
              title: "Annual",
              price: "50",
              currency: "USD",
              checkoutUrl: "https://evil.example/checkout",
            },
          ],
        },
      });
    return Response.json({
      code: 200,
      data: { checkoutUrl: "https://satellai.com/checkouts/test" },
    });
  };
  return calls;
}
test("dashboard reads are scoped to the authenticated identity and return only approved fields", async () => {
  const calls = mock();
  const result = await loadAccountData(env, { email, idToken });
  assert.equal(result.devices.items.length, 1);
  assert.equal(result.subscriptions.items.length, 1);
  assert.ok(!JSON.stringify(result).includes("must-not-be-serialized"));
  assert.ok(!JSON.stringify(result).includes("test-key"));
  assert.ok(!JSON.stringify(result).includes(idToken));
  assert.ok(
    calls
      .filter((call) => call.url.includes("query-by-email"))
      .every(
        (call) =>
          new Headers(call.headers).get("Authorization") ===
          `Bearer ${idToken}`,
      ),
  );
  assert.equal(
    calls.find((call) => call.url.endsWith("subscriptions-by-customer")).body
      .email,
    email,
  );
  assert.ok(
    !calls.some((call) => call.method === "DELETE" || call.method === "PUT"),
  );
});
test("binding ignores supplied account identity and derives plan ownership from fresh server data", async () => {
  const calls = mock();
  const result = await accountAction(
    request({
      intent: "bind",
      sn: "OWN-SN",
      contractId: "PLAN-1",
      siteKey: "satellai-us",
      email: "other@example.invalid",
      customerId: "attacker",
    }),
    env,
    {},
  );
  assert.equal(result.data.ok, true);
  const mutation = calls.find((call) => call.method === "PUT");
  assert.equal(mutation.body.contactEmail, email);
  assert.equal(
    new Headers(mutation.headers).get("Origin"),
    "https://satellai.com",
  );
  assert.equal(new Headers(mutation.headers).get("x-api-key"), "test-key");
  assert.equal(mutation.body.customerId, "123");
});
test("foreign devices, foreign plans and unavailable entitlements cannot be changed", async () => {
  for (const [values, config] of [
    [{ sn: "FOREIGN-SN", contractId: "PLAN-1" }, {}],
    [{ sn: "OWN-SN", contractId: "FOREIGN-PLAN" }, {}],
    [{ sn: "OWN-SN", contractId: "PLAN-1" }, { failTrials: true }],
  ]) {
    const calls = mock(config);
    const result = await accountAction(
      request({ intent: "bind", siteKey: "satellai-us", ...values }),
      env,
      {},
    );
    assert.equal(result.data.error, "forbidden");
    assert.ok(!calls.some((call) => call.method === "PUT"));
  }
});
test("another owner's lifetime plan cannot be disconnected", async () => {
  const calls = mock({ bound: true, lifetime: true, owner: false });
  const result = await accountAction(
    request({ intent: "unbind", sn: "OWN-SN" }),
    env,
    {},
  );
  assert.equal(result.data.error, "forbidden");
  assert.ok(!calls.some((call) => call.method === "DELETE"));
  assert.equal(
    canUnbind(
      {
        entitlementLoaded: true,
        contractId: "lifetime:123",
        siteKey: "satellai-us",
        isLifeTimeCard: true,
        originalOwner: null,
      },
      [],
    ),
    false,
  );
});
test("confirmed disconnects use the real server-provided contract", async () => {
  const calls = mock({ bound: true });
  const result = await accountAction(
    request({ intent: "unbind", sn: "OWN-SN", contractId: "FORGED" }),
    env,
    {},
  );
  assert.equal(result.data.ok, true);
  assert.equal(
    calls.find((call) => call.method === "DELETE").body.subscriptionContractId,
    "PLAN-1",
  );
});
test("redemption extension validates the target contract and device before consuming a code", async () => {
  const calls = mock({ rewardType: "EXTEND_DURATION" });
  const result = await accountAction(
    request({
      intent: "reward-redeem",
      sn: "OWN-SN",
      code: "CODE",
      contractId: "FOREIGN-PLAN",
      siteKey: "satellai-us",
    }),
    env,
    {},
  );
  assert.equal(result.data.error, "forbidden");
  assert.ok(
    !calls.some(
      (call) => call.url.endsWith("/claim") || call.url.endsWith("/add-manual"),
    ),
  );
});
test("checkout links are restricted to the configured store and no reads masquerade as empty data", async () => {
  mock();
  const result = await accountAction(
    request({ intent: "plans", sn: "OWN-SN" }),
    env,
    {},
  );
  assert.equal(result.data.plans[0].checkoutUrl, null);
  assert.equal(
    safeCheckout("https://satellai.com.evil.example/checkout", env),
    null,
  );
  assert.equal(safeCheckout("javascript:alert(1)", env), null);
  assert.equal(safeCheckout("https://user@evil.example/checkout", env), null);
  mock({ failGo: true });
  const failed = await loadAccountData(env, { email, idToken });
  assert.equal(failed.devices.state, "error");
});
test("missing sessions do not contact any backend", async () => {
  const calls = mock();
  const result = await accountAction(
    request({ intent: "bind" }, false),
    env,
    {},
  );
  assert.equal(result.headers.get("Location"), "/account/login");
  assert.equal(calls.length, 0);
});
test("Multipass exchange validates its origin and seals Shopify tokens", async () => {
  const calls = [];
  const client = {
    async graphql(_query, options) {
      calls.push(options);
      return {
        data: {
          customerAccessTokenCreateWithMultipass: {
            customerAccessToken: {
              accessToken: "private-shopify-customer-token",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          },
        },
      };
    },
  };
  assert.equal(
    await connectShopify(
      new Request("https://store.example/account"),
      env,
      client,
      "https://evil.example/account/login/multipass/secret",
    ),
    null,
  );
  assert.equal(calls.length, 0);
  const result = await connectShopify(
    new Request("https://store.example/account"),
    env,
    client,
    "https://satellai.com/account/login/multipass/single-use-token",
  );
  assert.ok(result.includes("HttpOnly"));
  assert.ok(!result.includes("private-shopify-customer-token"));
  assert.equal(calls[0].variables.token, "single-use-token");
});
test("foreign Shopify addresses cannot be mutated", async () => {
  const commerceCookie = await sessions.createShopifySession(
    new Request("https://store.example/account"),
    env,
    "shopify-token",
    new Date(Date.now() + 3600000).toISOString(),
  );
  const base = request({ intent: "address-delete", id: "FOREIGN-ADDRESS" });
  const headers = new Headers(base.headers);
  headers.set(
    "Cookie",
    `${cookie.split(";")[0]}; ${commerceCookie.split(";")[0]}`,
  );
  let calls = 0;
  const client = {
    async graphql() {
      calls++;
      return {
        data: {
          customer: { email, addresses: { nodes: [{ id: "OWN-ADDRESS" }] } },
        },
      };
    },
  };
  const result = await accountAction(
    new Request(base, { headers }),
    env,
    client,
  );
  assert.equal(result.data.error, "forbidden");
  assert.equal(calls, 1);
});

test("GID and numeric contract identities match only within their own site", async () => {
  const { ownedSubscription } = await server.ssrLoadModule(
    "/app/lib/account/rules.ts",
  );
  const rows = [
    { id: "gid://shopify/SubscriptionContract/123", siteKey: "satellai-us" },
  ];
  assert.equal(ownedSubscription(rows, "123", "satellai-us"), rows[0]);
  assert.equal(ownedSubscription(rows, "123", "satellai-global"), undefined);
});
test("owned contact and address mutations preserve the protected Shopify session", async () => {
  const commerceCookie = await sessions.createShopifySession(
    new Request("https://store.example/account"),
    env,
    "protected-shopify-token",
    new Date(Date.now() + 3600000).toISOString(),
  );
  const payloads = {
    profile: ["customerUpdate", { customer: { id: "123" } }],
    "address-create": [
      "customerAddressCreate",
      { customerAddress: { id: "NEW" } },
    ],
    "address-update": [
      "customerAddressUpdate",
      { customerAddress: { id: "OWN" } },
    ],
    "address-delete": [
      "customerAddressDelete",
      { deletedCustomerAddressId: "OWN" },
    ],
    "address-default": [
      "customerDefaultAddressUpdate",
      { customer: { id: "123" } },
    ],
  };
  for (const [intent, [key, payload]] of Object.entries(payloads)) {
    const base = request({
      intent,
      id: "OWN",
      firstName: "Test",
      lastName: "Owner",
      address1: "1 Test Street",
      city: "Test City",
      country: "United States",
      zip: "10001",
      token: "forged-token",
    });
    const headers = new Headers(base.headers);
    headers.set(
      "Cookie",
      `${cookie.split(";")[0]}; ${commerceCookie.split(";")[0]}`,
    );
    const calls = [];
    const client = {
      async graphql(query, options) {
        calls.push(options);
        return calls.length === 1
          ? {
              data: {
                customer: { email, addresses: { nodes: [{ id: "OWN" }] } },
              },
            }
          : { data: { [key]: { ...payload, customerUserErrors: [] } } };
      },
    };
    const result = await accountAction(
      new Request(base, { headers }),
      env,
      client,
    );
    assert.equal(result.data.ok, true, intent);
    assert.equal(calls[1].variables.token, "protected-shopify-token");
    assert.ok(!JSON.stringify(result.data).includes("protected-shopify-token"));
  }
});
