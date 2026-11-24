import { AuthShell, VerifyForm } from "~/components/account";
import { TranslationProvider, useTranslations } from "~/i18n";
import { verify } from "~/.server/auth/actions";
import { loadAuthPage } from "~/.server/auth/page";
import { envContext } from "~/lib/env";
import type { Route } from "./+types/verify";
export function meta() {
  return [{ title: "Verify email | SATELLAI" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  return loadAuthPage(request, context.get(envContext), "verify");
}
export async function action({ request, context }: Route.ActionArgs) {
  return verify(request, context.get(envContext));
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
      title={t("account.verify.title")}
      description={t("account.verify.description")}
    >
      <VerifyForm result={actionData} email={loaderData.email} />
    </AuthShell>
  );
}
