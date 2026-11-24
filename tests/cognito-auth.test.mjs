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
const actions = await server.ssrLoadModule("/app/.server/auth/actions.ts");
const sessions = await server.ssrLoadModule("/app/.server/auth/session.ts");
const pages = await server.ssrLoadModule("/app/.server/auth/page.ts");
const recovery = await server.ssrLoadModule("/app/.server/auth/recovery.ts");
const logout = await server.ssrLoadModule("/app/routes/account/logout.ts");
const env = {
  SESSION_SECRET: "test-only-session-secret-at-least-32-characters",
};
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
function request(path, values = {}, origin = "https://store.example") {
  return new Request(`https://store.example${path}`, {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams(values),
  });
}
function mockResponse(body, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), init });
    return Response.json(body, { status });
  };
  return calls;
}
function cookieRequest(cookies) {
  return new Request("https://store.example/account", {
    headers: {
      Cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; "),
    },
  });
}
const validRegistration = {
  firstName: "Test",
  lastName: "User",
  email: "test@example.invalid",
  password: "Test-pass-123",
  ageConsent: "on",
  termsConsent: "on",
};

test("registration Next does not create an account and Skip drops optional purchase fields", async () => {
  const calls = mockResponse({ success: true });
  const next = await actions.register(
    request("/account/register", { ...validRegistration, intent: "next" }),
    env,
  );
  assert.equal(next.init.status, 400);
  assert.equal(calls.length, 0);
  const skipped = await actions.register(
    request("/account/register", {
      ...validRegistration,
      intent: "skip",
      purchaseRegion: "EU",
      purchaseChannel: "amazon",
    }),
    env,
  );
  assert.equal(skipped.headers.get("Location"), "/account/verify");
  assert.equal(calls.length, 1);
  assert.equal(Object.hasOwn(calls[0].body, "purchaseRegion"), false);
  assert.equal(Object.hasOwn(calls[0].body, "purchaseChannel"), false);
});

test("password recovery sends the legacy payload and keeps the email in a purpose-bound cookie", async () => {
  const calls = mockResponse({ success: true });
  const response = await recovery.requestPasswordReset(
    request("/account/forgot-password", { email: validRegistration.email }),
    env,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/account/reset-password");
  assert.match(calls[0].url, /\/request-reset$/);
  assert.deepEqual(calls[0].body, { email: validRegistration.email });
  const cookie = response.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/);
  assert.doesNotMatch(cookie, /test@example/);
  assert.equal(
    await sessions.readResetEmail(cookieRequest([cookie]), env),
    validRegistration.email,
  );
  assert.equal(
    await sessions.readPendingEmail(cookieRequest([cookie]), env),
    "",
  );
  assert.equal(
    (
      await pages.loadAuthPage(
        new Request(
          "https://store.example/account/reset-password?email=test@example.invalid",
        ),
        env,
        "reset-password",
      )
    ).headers.get("Location"),
    "/account/forgot-password",
  );
});

test("recovery uses the same public response for unconfirmed and unknown accounts and preserves rate limits", async () => {
  for (const code of ["UserNotFoundException", "UserNotConfirmedException"]) {
    mockResponse({ success: false, code }, 400);
    const response = await recovery.requestPasswordReset(
      request("/account/forgot-password", { email: validRegistration.email }),
      env,
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/account/reset-password");
  }
  mockResponse({ success: false, code: "LimitExceededException" }, 429);
  const limited = await recovery.requestPasswordReset(
    request("/account/forgot-password", { email: validRegistration.email }),
    env,
  );
  assert.equal(limited.data.error, "rate");
});

test("reset confirmation validates origin, cookie purpose, code and matching passwords before calling Cognito", async () => {
  const calls = mockResponse({ success: true });
  const resetCookie = await sessions.createResetEmail(
    request("/account/reset-password"),
    env,
    validRegistration.email,
  );
  const verifyCookie = await sessions.createPendingEmail(
    request("/account/verify"),
    env,
    validRegistration.email,
  );
  const values = {
    code: "123456",
    newPassword: "Next-pass-123",
    confirmPassword: "Next-pass-123",
  };
  const confirm = (form, cookie, origin) => {
    const submission = request("/account/reset-password", form, origin);
    if (cookie) submission.headers.set("Cookie", cookie.split(";")[0]);
    return recovery.confirmPasswordReset(submission, env);
  };
  assert.equal(
    (await confirm(values, resetCookie, "https://elsewhere.example")).data
      .error,
    "request",
  );
  assert.equal(
    (await confirm(values, verifyCookie)).data.error,
    "resetSession",
  );
  assert.equal(
    (await confirm({ ...values, code: " " }, resetCookie)).data.error,
    "code",
  );
  assert.equal(
    (await confirm({ ...values, newPassword: "weak" }, resetCookie)).data.error,
    "password",
  );
  assert.equal(
    (
      await confirm(
        { ...values, confirmPassword: "Other-pass-123" },
        resetCookie,
      )
    ).data.error,
    "passwordMismatch",
  );
  assert.equal(calls.length, 0);
  const success = await confirm(
    { ...values, email: "unexpected@example.invalid" },
    resetCookie,
  );
  assert.match(calls[0].url, /\/confirm-reset$/);
  assert.deepEqual(calls[0].body, {
    email: validRegistration.email,
    code: values.code,
    newPassword: values.newPassword,
  });
  assert.equal(success.headers.get("Location"), "/account/login");
  const cookies = success.headers.getSetCookie();
  assert.equal(
    cookies.filter((cookie) => cookie.includes("Max-Age=0")).length,
    4,
  );
  const loginPage = await pages.loadAuthPage(
    cookieRequest(cookies),
    env,
    "login",
  );
  assert.equal(loginPage.data.passwordReset, true);
  assert.match(loginPage.init.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal(loginPage.data.event, null);
});

test("reset rejection retains the recovery step without echoing code or passwords", async () => {
  mockResponse({ success: false, code: "ExpiredCodeException" }, 400);
  const cookie = await sessions.createResetEmail(
    request("/account/reset-password"),
    env,
    validRegistration.email,
  );
  const submission = request("/account/reset-password", {
    code: "123456",
    newPassword: "Next-pass-123",
    confirmPassword: "Next-pass-123",
  });
  submission.headers.set("Cookie", cookie.split(";")[0]);
  const failure = await recovery.confirmPasswordReset(submission, env);
  assert.equal(failure.data.error, "expired");
  assert.doesNotMatch(
    JSON.stringify(failure.data),
    /123456|Next-pass|test@example/,
  );
  assert.equal(failure.init.headers?.get("Set-Cookie"), undefined);
});

test("registration preserves the proxy contract and keeps the email out of redirects", async () => {
  const calls = mockResponse({ success: true });
  const result = await actions.register(
    request("/account/register", {
      ...validRegistration,
      purchaseRegion: "EU",
      purchaseChannel: "amazon",
    }),
    env,
  );
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("Location"), "/account/verify");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/sales/auth/sign-up"));
  assert.deepEqual(calls[0].body, {
    email: validRegistration.email,
    firstName: "Test",
    lastName: "User",
    password: validRegistration.password,
    purchaseRegion: "EU",
    purchaseChannel: "amazon",
  });
  assert.equal(
    await sessions.readPendingEmail(
      cookieRequest(result.headers.getSetCookie()),
      env,
    ),
    validRegistration.email,
  );
  assert.ok(
    !result.headers.get("Set-Cookie").includes(validRegistration.email),
  );
});

test("validation, origin, body limits and configuration fail before any upstream request", async () => {
  const calls = mockResponse({ success: true });
  for (const [values, error] of [
    [{ ...validRegistration, ageConsent: "" }, "consent"],
    [{ ...validRegistration, password: "weak" }, "password"],
    [
      {
        ...validRegistration,
        purchaseRegion: "APAC",
        purchaseChannel: "amazon",
      },
      "request",
    ],
  ]) {
    const result = await actions.register(
      request("/account/register", values),
      env,
    );
    assert.equal(result.data.error, error);
    assert.ok(!JSON.stringify(result.data).includes(values.password));
  }
  assert.equal(
    (
      await actions.register(
        request("/account/register", validRegistration, "https://evil.example"),
        env,
      )
    ).data.error,
    "request",
  );
  assert.equal(
    (
      await actions.register(
        request("/account/register", {
          ...validRegistration,
          padding: "x".repeat(17000),
        }),
        env,
      )
    ).data.error,
    "request",
  );
  assert.equal(
    (
      await actions.register(
        request("/account/register", validRegistration),
        {},
      )
    ).data.error,
    "session",
  );
  assert.equal(calls.length, 0);
});

test("existing unconfirmed users enter verification; confirmed duplicates show a useful error", async () => {
  mockResponse(
    { success: false, code: "UsernameExistsException", unconfirmed: true },
    400,
  );
  assert.equal(
    (
      await actions.register(
        request("/account/register", validRegistration),
        env,
      )
    ).headers.get("Location"),
    "/account/verify",
  );
  mockResponse({ success: false, code: "UsernameExistsException" }, 400);
  assert.equal(
    (
      await actions.register(
        request("/account/register", validRegistration),
        env,
      )
    ).data.error,
    "exists",
  );
});

test("verification and resend use their distinct contracts; success events require confirmation", async () => {
  let calls = mockResponse({ success: true });
  const resent = await actions.verify(
    request("/account/verify", {
      email: validRegistration.email,
      intent: "resend",
    }),
    env,
  );
  assert.ok(resent.data.resent);
  assert.deepEqual(calls[0].body, { username: validRegistration.email });
  assert.ok(calls[0].url.endsWith("/resend-confirmation"));
  calls = mockResponse(
    {
      success: false,
      code: "CodeMismatchException",
      message: "sensitive backend message",
    },
    400,
  );
  const invalid = await actions.verify(
    request("/account/verify", {
      email: validRegistration.email,
      code: "000000",
    }),
    env,
  );
  assert.equal(invalid.data.error, "code");
  assert.ok(!JSON.stringify(invalid.data).includes("sensitive"));
  assert.deepEqual(calls[0].body, {
    username: validRegistration.email,
    code: "000000",
  });
  mockResponse({ success: true });
  const success = await actions.verify(
    request("/account/verify", {
      email: validRegistration.email,
      code: "123456",
    }),
    env,
  );
  assert.equal(success.headers.get("Location"), "/account/login");
  const event = await sessions.readAuthEvent(
    cookieRequest(success.headers.getSetCookie()),
    env,
  );
  assert.equal(event.name, "sign_up");
  assert.ok(!JSON.stringify(event).includes(validRegistration.email));
});

function idToken(exp = Math.floor(Date.now() / 1000) + 3600) {
  return `test.${Buffer.from(JSON.stringify({ sub: "test-subject", token_use: "id", email: validRegistration.email, given_name: "Test", family_name: "User", exp })).toString("base64url")}.test-signature`;
}
test("login creates an encrypted local session without exposing tokens or following legacy redirects", async () => {
  const token = idToken();
  const calls = mockResponse({
    success: true,
    tokens: {
      idToken: token,
      accessToken: "unused-access",
      refreshToken: "unused-refresh",
    },
    result: "https://satellai.com/account/login/multipass/not-followed",
  });
  const result = await actions.login(
    request("/account/login", {
      email: validRegistration.email,
      password: validRegistration.password,
    }),
    env,
  );
  assert.equal(result.headers.get("Location"), "/account");
  assert.deepEqual(calls[0].body, {
    username: validRegistration.email,
    password: validRegistration.password,
    target_path: "/account",
    site_domain: "satellai.com",
  });
  const cookies = result.headers.getSetCookie();
  assert.equal(cookies.length, 3);
  for (const cookie of cookies) {
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.ok(!cookie.includes(token));
  }
  const session = await sessions.readCognitoSession(
    cookieRequest(cookies),
    env,
  );
  assert.equal(session.email, validRegistration.email);
  assert.equal(session.idToken, token);
  assert.ok(!JSON.stringify(session).includes("unused-access"));
  assert.ok(!JSON.stringify(session).includes("unused-refresh"));
  assert.equal(
    (await sessions.readAuthEvent(cookieRequest(cookies), env)).name,
    "login",
  );
});

test("tampered, expired and cross-purpose cookies cannot authenticate", async () => {
  const cookie = await sessions.createCognitoSession(
    request("/account/login"),
    env,
    idToken(),
  );
  const [pair] = cookie.split(";");
  const last = pair.length - 10;
  const tampered = `${pair.slice(0, last)}${pair[last] === "a" ? "b" : "a"}${pair.slice(last + 1)}`;
  assert.equal(
    await sessions.readCognitoSession(cookieRequest([tampered]), env),
    null,
  );
  assert.equal(
    await sessions.readCognitoSession(cookieRequest([cookie]), {
      SESSION_SECRET: "other-test-secret-at-least-32-characters",
    }),
    null,
  );
  const eventCookie = await sessions.createAuthEvent(
    request("/account/login"),
    env,
    "login",
  );
  assert.equal(
    await sessions.readCognitoSession(
      cookieRequest([
        eventCookie.replace("satellai-auth-event", "satellai-cognito"),
      ]),
      env,
    ),
    null,
  );
  await assert.rejects(() =>
    sessions.createCognitoSession(request("/account/login"), env, idToken(1)),
  );
  const now = Date.now;
  Date.now = () => now() + 7200000;
  try {
    assert.equal(
      await sessions.readCognitoSession(cookieRequest([cookie]), env),
      null,
    );
  } finally {
    Date.now = now;
  }
});

test("network failure, throttling and missing tokens do not create a session", async () => {
  globalThis.fetch = async () => {
    throw new Error("private network detail");
  };
  assert.equal(
    (await actions.login(request("/account/login", validRegistration), env))
      .data.error,
    "unavailable",
  );
  mockResponse({ success: false }, 429);
  assert.equal(
    (await actions.login(request("/account/login", validRegistration), env))
      .data.error,
    "rate",
  );
  mockResponse({ success: true });
  assert.equal(
    (await actions.login(request("/account/login", validRegistration), env))
      .data.error,
    "session",
  );
});

test("logout requires a same-origin POST and expires all auth cookies", async () => {
  const result = await logout.action({ request: request("/account/logout") });
  assert.equal(result.status, 303);
  assert.equal(result.headers.getSetCookie().length, 4);
  for (const cookie of result.headers.getSetCookie())
    assert.match(cookie, /Max-Age=0/);
  assert.equal(
    (
      await logout.action({
        request: request("/account/logout", {}, "https://evil.example"),
      })
    ).status,
    403,
  );
});

test("legacy verification URLs are upgraded to a clean URL with a protected pending email", async () => {
  const result = await pages.loadAuthPage(
    new Request(
      `https://store.example/account/register?unconfirmed=true&email=${validRegistration.email}`,
    ),
    env,
    "register",
  );
  assert.equal(result.headers.get("Location"), "/account/verify");
  assert.equal(
    await sessions.readPendingEmail(
      cookieRequest(result.headers.getSetCookie()),
      env,
    ),
    validRegistration.email,
  );
});

test("account loader returns only derived profile fields and redirects expired sessions", async () => {
  const account = await server.ssrLoadModule("/app/routes/account/account.tsx");
  const cookie = await sessions.createCognitoSession(
    request("/account/login"),
    env,
    idToken(),
  );
  const result = await account.loader({
    request: cookieRequest([cookie]),
    context: { get: () => env },
  });
  assert.deepEqual(result.data.profile, {
    firstName: "Test",
    lastName: "User",
    email: validRegistration.email,
  });
  assert.ok(!JSON.stringify(result.data).includes("idToken"));
  assert.ok(!JSON.stringify(result.data).includes("test-signature"));
  const signedOut = await account.loader({
    request: new Request("https://store.example/account"),
    context: { get: () => env },
  });
  assert.equal(signedOut.headers.get("Location"), "/account/login");
});

test("server environment overrides both the Cognito endpoint and the legacy site_domain", async () => {
  const calls = mockResponse({ success: true, tokens: { idToken: idToken() } });
  const response = await actions.login(
    request("/account/login", {
      email: validRegistration.email,
      password: validRegistration.password,
    }),
    {
      ...env,
      COGNITO_AUTH_API_URL: "https://auth.example.invalid/custom-auth",
      COGNITO_LEGACY_STORE_DOMAIN: "legacy.example.invalid",
    },
  );
  assert.equal(response.status, 303);
  assert.equal(calls[0].url, "https://auth.example.invalid/custom-auth/login");
  assert.equal(calls[0].body.site_domain, "legacy.example.invalid");
});
