import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  createMiniOxygen,
  Response as RuntimeResponse,
} from "@shopify/mini-oxygen";
import { transformWithEsbuild } from "vite";

test("Cognito requests work in MiniOxygen and do not follow credential redirects", async () => {
  const source = await readFile(
    new URL("../app/.server/auth/cognito.ts", import.meta.url),
    "utf8",
  );
  const { code } = await transformWithEsbuild(source, "cognito.server.ts", {
    loader: "ts",
  });
  const calls = [];
  let upstreamRedirect = false;
  const runtime = createMiniOxygen({
    requestHook: null,
    workers: [
      {
        name: "cognito-regression",
        modules: true,
        script: `${code}
        export default { async fetch() {
          try {
            await callCognito({COGNITO_AUTH_API_URL: "https://auth.example.invalid/sales/auth"}, "login", {username: "runtime@example.invalid", password: "not-a-real-password"});
            return Response.json({ok: true});
          } catch (error) { return Response.json({reason: error.reason}, {status: 502}); }
        }};`,
        async outboundService(request) {
          calls.push({
            url: request.url,
            method: request.method,
            agent: request.headers.get("user-agent"),
            contentType: request.headers.get("content-type"),
            body: JSON.parse(await request.text()),
          });
          if (upstreamRedirect)
            return new RuntimeResponse(null, {
              status: 302,
              headers: { Location: "https://other.example.invalid/collect" },
            });
          // Mirror the original distribution's rejection of requests with no agent.
          if (!request.headers.get("user-agent"))
            return new RuntimeResponse("Blocked", { status: 403 });
          return RuntimeResponse.json({ success: true });
        },
      },
    ],
  });
  try {
    await runtime.ready;
    const response = await runtime.dispatchFetch(
      "https://store.example.invalid/test",
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      url: "https://auth.example.invalid/sales/auth/login",
      method: "POST",
      agent: "SATELLAI-Headless/1.0",
      contentType: "application/json",
      body: {
        username: "runtime@example.invalid",
        password: "not-a-real-password",
      },
    });
    upstreamRedirect = true;
    calls.length = 0;
    const rejected = await runtime.dispatchFetch(
      "https://store.example.invalid/test",
    );
    assert.equal(rejected.status, 502);
    assert.deepEqual(await rejected.json(), { reason: "unavailable" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://auth.example.invalid/sales/auth/login");
  } finally {
    await runtime.dispose();
  }
});
