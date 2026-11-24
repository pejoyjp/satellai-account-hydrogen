import type { ShouldRevalidateFunction } from "react-router";
import { AccountDashboard } from "~/components/account";
import { TranslationProvider } from "~/i18n";
import { envContext } from "~/lib/env";
import { storefrontClientContext } from "~/.server/shopify/storefront";
import { loadDashboard, accountAction } from "~/.server/account";
import type { Route } from "./+types/account";
export function meta() {
  return [{ title: "Your account | SATELLAI" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  return loadDashboard(
    request,
    context.get(envContext),
    context.get(storefrontClientContext),
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  return accountAction(
    request,
    context.get(envContext),
    context.get(storefrontClientContext),
  );
}
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  actionResult,
  defaultShouldRevalidate,
}: Parameters<ShouldRevalidateFunction>[0]) {
  if (actionResult && ["plans", "reward-check"].includes(actionResult.intent))
    return false;
  if (
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    (currentUrl.searchParams.get("tab") !== nextUrl.searchParams.get("tab") ||
      currentUrl.searchParams.get("page") !==
        nextUrl.searchParams.get("page")) &&
    currentUrl.searchParams.get("after") ===
      nextUrl.searchParams.get("after") &&
    currentUrl.searchParams.get("before") === nextUrl.searchParams.get("before")
  )
    return false;
  return defaultShouldRevalidate;
}
export default function AccountRoute({ loaderData }: Route.ComponentProps) {
  return (
    <TranslationProvider namespace="account" catalog={loaderData.translations}>
      <AccountDashboard
        account={loaderData.account}
        commerce={loaderData.commerce}
        profile={loaderData.profile}
      />
    </TranslationProvider>
  );
}
