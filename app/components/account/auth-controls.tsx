import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useNavigation } from "react-router";
import { Button, type ButtonProps } from "~/components/ui";
import { useTranslations } from "~/i18n";
import type { AuthResult } from "~/lib/auth";
import { cn } from "~/utils/cn";

export const authInputClass =
  "form-input typo-body border-border bg-surface text-on-surface placeholder:text-on-surface-secondary min-h-14 w-full min-w-0 rounded-xl border px-4 py-3 disabled:bg-surface-secondary disabled:text-on-surface-secondary";
export function AuthField({
  label,
  name,
  type = "text",
  help,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  help?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("account");
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const id = `account-${name}`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="typo-control-label-strong text-on-surface" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          name={name}
          type={password && visible ? "text" : type}
          aria-invalid={invalid || undefined}
          aria-describedby={help ? `${id}-help` : undefined}
          className={cn(
            authInputClass,
            password && "pr-14",
            invalid && "border-critical",
          )}
        />
        {password ? (
          <button
            type="button"
            className="text-on-surface-secondary hover:text-on-surface focus-visible:outline-accent absolute inset-y-0 right-1 my-auto flex size-12 items-center justify-center rounded-full focus-visible:outline-2"
            aria-label={t(
              visible ? "account.hidePassword" : "account.showPassword",
            )}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        ) : null}
      </div>
      {help ? (
        <p id={`${id}-help`} className="typo-body-sm text-on-surface-secondary">
          {help}
        </p>
      ) : null}
    </div>
  );
}
export function AuthNotice({
  result,
  success,
}: {
  result?: AuthResult;
  success?: string;
}) {
  const t = useTranslations("account");
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (result?.error) ref.current?.focus();
  }, [result]);
  if (!result?.error && !success) return null;
  return (
    <p
      ref={ref}
      id="auth-feedback"
      tabIndex={-1}
      role={result?.error ? "alert" : "status"}
      className={cn(
        "typo-body-sm rounded-xl border p-4 outline-none",
        result?.error
          ? "text-critical border-critical/20 bg-critical/5"
          : "text-success border-success/20 bg-success/5",
      )}
    >
      {result?.error ? t(`account.error.${result.error}`) : success}
    </p>
  );
}
export function AuthSubmit({ children, ...props }: ButtonProps) {
  const t = useTranslations("account");
  const navigation = useNavigation();
  const pending = navigation.state !== "idle" && !!navigation.formMethod;
  return (
    <Button
      {...props}
      type="submit"
      size="lg"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={cn("w-full disabled:aria-busy:opacity-85", props.className)}
    >
      {pending ? (
        <>
          <span className="invisible">{children}</span>
          <LoaderCircle
            aria-hidden="true"
            className="loading-spin absolute size-5"
          />
          <span className="sr-only" role="status">
            {t("account.pending")}
          </span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
