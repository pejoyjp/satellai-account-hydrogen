import { useEffect, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui";
import { useTranslations } from "~/i18n";
import type { AuthResult } from "~/lib/auth";
import { AuthField, AuthNotice, AuthSubmit } from "./auth-controls";
export function VerifyForm({
  email,
  result,
}: {
  email: string;
  result?: AuthResult;
}) {
  const t = useTranslations("account");
  const navigation = useNavigation();
  const pending = navigation.state !== "idle" && !!navigation.formMethod;
  const [waiting, setWaiting] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  useEffect(() => {
    if (result?.resent) setResendAt(result.resent);
  }, [result?.resent]);
  useEffect(() => {
    if (!resendAt) return;
    setWaiting(true);
    const timer = setTimeout(() => setWaiting(false), 60000);
    return () => clearTimeout(timer);
  }, [resendAt]);
  return (
    <Form method="post" className="flex flex-col gap-6">
      <AuthNotice
        result={result}
        success={result?.resent ? t("account.resent") : undefined}
      />
      <AuthField
        label={t("account.email")}
        name="email"
        type="email"
        required
        autoComplete="email"
        maxLength={254}
        defaultValue={result?.email || email}
        invalid={result?.field === "email"}
      />
      <AuthField
        label={t("account.code")}
        name="code"
        required
        autoComplete="one-time-code"
        maxLength={64}
      />
      <AuthSubmit name="intent" value="verify">
        {t("account.verify")}
      </AuthSubmit>
      <Button
        type="submit"
        name="intent"
        value="resend"
        variant="outline"
        size="lg"
        formNoValidate
        disabled={pending || waiting}
        className="w-full"
      >
        {t(waiting ? "account.resendWait" : "account.resend")}
      </Button>
      <Link
        to="/account/login"
        className="typo-body-sm text-on-surface-secondary hover:text-accent self-center underline underline-offset-4"
      >
        {t("account.signIn")}
      </Link>
    </Form>
  );
}
