import { requestPasswordReset, loadAuthPage } from "~/.server/auth";
import { PasswordRecoveryForm } from "~/components/account";
import { TranslationProvider } from "~/i18n";
import { envContext } from "~/lib/env";
import type { Route } from "./+types/forgot-password";

export function meta() {
  return [{ title: "Forgot password | SATELLAI" }];
}

export function loader({ request, context }: Route.LoaderArgs) {
  return loadAuthPage(request, context.get(envContext), "forgot-password");
}

export function action({ request, context }: Route.ActionArgs) {
  return requestPasswordReset(request, context.get(envContext));
}

export default function ForgotPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <TranslationProvider namespace="account" catalog={loaderData.translations}>
      <PasswordRecoveryForm
        step="request"
        email={loaderData.email}
        result={actionData}
      />
    </TranslationProvider>
  );
}
