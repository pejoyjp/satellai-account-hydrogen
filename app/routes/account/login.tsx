import { storefrontClientContext } from "~/.server/shopify/storefront";
import { AuthShell, LoginForm } from "~/components/account";
import { TranslationProvider, useTranslations } from "~/i18n";
import { login } from "~/.server/auth/actions";
import { loadAuthPage } from "~/.server/auth/page";
import { envContext } from "~/lib/env";
import type { Route } from "./+types/login";
export function meta() {
  return [{ title: "Sign in | SATELLAI" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  return loadAuthPage(request, context.get(envContext), "login");
}
export async function action({ request, context }: Route.ActionArgs) {
  return login(
    request,
    context.get(envContext),
    context.get(storefrontClientContext),
  );
}
export default function RoutePage(props: Route.ComponentProps) {
  return (
    <TranslationProvider
      namespace="account"
      catalog={props.loaderData.translations}
    >
      <Content {...props} />
    </TranslationProvider>
  );
}
function Content({ loaderData, actionData }: Route.ComponentProps) {
  const t = useTranslations("account");
  return (
    <AuthShell
      title={t("account.login.title")}
      description={t("account.login.description")}
    >
      <LoginForm
        result={actionData}
        verified={loaderData.verified}
        passwordReset={loaderData.passwordReset}
      />
    </AuthShell>
  );
}
