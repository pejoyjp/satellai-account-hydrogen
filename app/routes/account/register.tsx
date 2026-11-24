import { AuthShell, RegisterForm } from "~/components/account";
import { TranslationProvider, useTranslations } from "~/i18n";
import { register } from "~/.server/auth/actions";
import { loadAuthPage } from "~/.server/auth/page";
import { envContext } from "~/lib/env";
import type { Route } from "./+types/register";
export function meta() {
  return [{ title: "Create account | SATELLAI" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  return loadAuthPage(request, context.get(envContext), "register");
}
export async function action({ request, context }: Route.ActionArgs) {
  return register(request, context.get(envContext));
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
      title={t("account.register.title")}
      description={t("account.register.description")}
    >
      <RegisterForm result={actionData} />
    </AuthShell>
  );
}
