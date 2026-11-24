import { Form, Link } from "react-router";
import { useTranslations } from "~/i18n";
import type { AuthResult } from "~/lib/auth";
import { AuthShell } from "./auth-shell";
import { AuthField, AuthNotice, AuthSubmit } from "./auth-controls";

export function PasswordRecoveryForm({
  step,
  email,
  result,
}: {
  step: "request" | "confirm";
  email?: string;
  result?: AuthResult;
}) {
  const t = useTranslations("account");
  const confirm = step === "confirm";
  return (
    <AuthShell
      title={t(
        confirm
          ? "account.recovery.resetTitle"
          : "account.recovery.forgotTitle",
      )}
      description={t(
        confirm
          ? "account.recovery.resetDescription"
          : "account.recovery.forgotDescription",
      )}
    >
      <Form method="post" className="flex flex-col gap-6">
        <AuthNotice result={result} />
        {confirm ? (
          <>
            <AuthField
              label={t("account.code")}
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={64}
              required
              invalid={result?.error === "code" || result?.error === "expired"}
            />
            <AuthField
              label={t("account.recovery.newPassword")}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
              help={t("account.passwordHelp")}
              invalid={result?.error === "password"}
            />
            <AuthField
              label={t("account.recovery.confirmPassword")}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
              invalid={result?.field === "confirmPassword"}
            />
          </>
        ) : (
          <AuthField
            label={t("account.email")}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            defaultValue={result?.email ?? email}
            invalid={result?.field === "email"}
          />
        )}
        {result?.error !== "resetSession" && (
          <AuthSubmit>
            {t(confirm ? "account.recovery.reset" : "account.recovery.send")}
          </AuthSubmit>
        )}
        <div className="typo-body-sm text-on-surface-secondary flex flex-wrap justify-center gap-x-6 gap-y-3">
          {confirm && (
            <Link
              to="/account/forgot-password"
              className="hover:text-accent underline underline-offset-4"
            >
              {t("account.recovery.requestAgain")}
            </Link>
          )}
          <Link
            to="/account/login"
            className="hover:text-accent underline underline-offset-4"
          >
            {t("account.recovery.backToLogin")}
          </Link>
        </div>
      </Form>
    </AuthShell>
  );
}
