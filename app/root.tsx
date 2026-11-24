import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import { NavigationProgress } from "~/components/ui";
import { DEFAULT_LOCALE, I18nProvider } from "~/i18n";
import { loadTranslations } from "~/i18n/resources";
import { useNonce } from "~/lib/csp";
import { envContext } from "~/lib/env";
import {
  resolveStorefrontOrigin,
  useStorefrontOrigin,
} from "~/lib/storefront-links";
import {
  createRequestStorefrontClient,
  storefrontClientContext,
} from "~/.server/shopify/storefront";
import type { Route } from "./+types/root";
import appStylesHref from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export const middleware: Route.MiddlewareFunction[] = [
  async ({ context, request }, next) => {
    const storefront = createRequestStorefrontClient(
      request,
      context.get(envContext),
    );
    context.set(storefrontClientContext, storefront);
    const response = await next();
    storefront?.requestContext.applyResponseHeaders(response.headers);
    return response;
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  return {
    common: await loadTranslations(DEFAULT_LOCALE, "common"),
    storefrontOrigin: resolveStorefrontOrigin(
      context.get(envContext).STOREFRONT_ORIGIN,
    ),
  };
}

export function Layout({ children }: { children: ReactNode }) {
  const nonce = useNonce();
  const rootData = useRouteLoaderData<typeof loader>("root");
  const storefrontOrigin = useStorefrontOrigin();

  return (
    <html lang={DEFAULT_LOCALE}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <Meta />
        <Links />
      </head>
      <body className="bg-surface text-on-surface font-body flex min-h-svh flex-col antialiased">
        <I18nProvider common={rootData?.common}>
          <a
            href="#main-content"
            className="focus-visible:bg-interactive focus-visible:text-interactive-text sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2"
          >
            Skip to content
          </a>
          <header className="bg-surface border-border sticky top-0 z-20 border-b">
            <nav
              aria-label="Account navigation"
              className="content-container flex h-16 items-center justify-between gap-4"
            >
              <Link to="/account" className="text-on-surface text-xl font-bold">
                SATELLAI
              </Link>
              <a
                href={storefrontOrigin}
                className="typo-control-label text-on-surface hover:underline"
              >
                Back to store
              </a>
            </nav>
          </header>
          {children}
        </I18nProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="content-container flex-1 py-12"
    >
      <h1 className="typo-display">
        {notFound ? "Page not found" : "Something went wrong"}
      </h1>
      <Link to="/account" className="mt-4 inline-block underline">
        Go to your account
      </Link>
    </main>
  );
}
