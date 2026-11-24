import { Form, Link } from "react-router";
import { useTranslations } from "~/i18n";
import type { AuthResult } from "~/lib/auth";
import { AuthField, AuthNotice, AuthSubmit } from "./auth-controls";
export function LoginForm({
  result,
  verified,
  passwordReset,
}: {
  result?: AuthResult;
  verified: boolean;
  passwordReset: boolean;
}) {
  const t = useTranslations("account");
  return (
    <Form method="post" className="flex flex-col gap-6">
      <AuthNotice
        result={result}
        success={
          passwordReset
            ? t("account.recovery.success")
            : verified
              ? t("account.verified")
              : undefined
        }
      />
      <AuthField
        label={t("account.email")}
        name="email"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        defaultValue={result?.email}
        invalid={result?.field === "email"}
      />
      <AuthField
        label={t("account.password")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={256}
        invalid={result?.field === "password"}
      />
      <Link
        to="/account/forgot-password"
        className="typo-body-sm text-on-surface-secondary hover:text-accent self-end underline underline-offset-4"
      >
        {t("account.forgotPassword")}
      </Link>
      <AuthSubmit>{t("account.signIn")}</AuthSubmit>
      <p className="typo-body-sm text-on-surface-secondary text-center">
        {t("account.noAccount")}{" "}
        <Link
          to="/account/register"
          className="text-on-surface hover:text-accent font-semibold underline underline-offset-4"
        >
          {t("account.signUp")}
        </Link>
      </p>
    </Form>
  );
}
