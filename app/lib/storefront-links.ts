import { useRouteLoaderData } from "react-router";

const defaultOrigin = "https://satellai.com";

export function resolveStorefrontOrigin(value?: string) {
  if (!value) return defaultOrigin;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    ) {
      return url.origin;
    }
  } catch {
    // A malformed deployment setting falls back to the main Liquid store.
  }
  return defaultOrigin;
}

export function useStorefrontOrigin() {
  return (
    useRouteLoaderData<{ storefrontOrigin: string }>("root")
      ?.storefrontOrigin ?? defaultOrigin
  );
}
