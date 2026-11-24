import { createContentSecurityPolicy } from "@shopify/hydrogen";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { ServerRouter, type EntryContext } from "react-router";

import { NonceProvider } from "~/lib/csp";
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  const csp = createContentSecurityPolicy({
    directives: {
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider value={csp.nonce}>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={csp.nonce}
      />
    </NonceProvider>,
    {
      nonce: csp.nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get("user-agent"))) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  csp.applyResponseHeaders(responseHeaders);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
