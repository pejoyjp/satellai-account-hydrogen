import { confirmPasswordReset, loadAuthPage } from "~/.server/auth";
import { PasswordRecoveryForm } from "~/components/account";
import { TranslationProvider } from "~/i18n";
import { envContext } from "~/lib/env";
import type { Route } from "./+types/reset-password";

export function meta() {
  return [{ title: "Reset password | SATELLAI" }];
}

export function loader({ request, context }: Route.LoaderArgs) {
  return loadAuthPage(request, context.get(envContext), "reset-password");
}

export function action({ request, context }: Route.ActionArgs) {
  return confirmPasswordReset(request, context.get(envContext));
}

export default function ResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <TranslationProvider namespace="account" catalog={loaderData.translations}>
      <PasswordRecoveryForm step="confirm" result={actionData} />
    </TranslationProvider>
  );
}
