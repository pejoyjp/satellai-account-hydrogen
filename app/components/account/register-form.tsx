import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui";
import { useTranslations } from "~/i18n";
import { useStorefrontOrigin } from "~/lib/storefront-links";
import { isValidEmail, isValidPassword, type AuthResult } from "~/lib/auth";
import {
  AuthField,
  AuthNotice,
  AuthSubmit,
  authInputClass,
} from "./auth-controls";

const channels = {
  NA: [
    "official_website",
    "amazon",
    "tiktok",
    "walmart",
    "best_buy",
    "tractor_supply",
    "petco",
    "chewy",
    "other_retail_store",
    "gift",
    "other",
    "dont_remember",
  ],
  EU: [
    "official_website",
    "amazon",
    "tiktok",
    "cdiscount",
    "fressnapf",
    "fruugo",
    "fnac",
    "allegro",
    "other_retail_store",
    "gift",
    "other",
    "dont_remember",
  ],
  APAC: ["official_website"],
} as const;
const checkboxClass =
  "mt-0.5 size-5 shrink-0 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";
export function RegisterForm({ result }: { result?: AuthResult }) {
  const t = useTranslations("account");
  const storefrontOrigin = useStorefrontOrigin();
  const [region, setRegion] = useState(result?.purchaseRegion || "");
  const [channel, setChannel] = useState(result?.purchaseChannel || "");
  const [details, setDetails] = useState(false);
  const [stepError, setStepError] = useState<AuthResult>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (details) headingRef.current?.focus();
  }, [details]);
  useEffect(() => {
    if (!result?.error) return;
    setDetails(
      result.field === "purchaseRegion" || result.field === "purchaseChannel",
    );
  }, [result]);
  const notice =
    stepError ??
    (details &&
    result?.field !== "purchaseRegion" &&
    result?.field !== "purchaseChannel"
      ? undefined
      : result);
  function next(event: FormEvent<HTMLFormElement>) {
    if (details) return;
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    if (
      !["firstName", "lastName"].every((name) =>
        String(fields.get(name) || "").trim(),
      )
    ) {
      setStepError({ error: "required" });
    } else if (!isValidEmail(email)) {
      setStepError({ error: "email", field: "email" });
    } else if (!isValidPassword(String(fields.get("password") || ""))) {
      setStepError({ error: "password", field: "password" });
    } else {
      setStepError(undefined);
      setDetails(true);
    }
  }
  const availableChannels = channels[region as keyof typeof channels] || [];
  return (
    <Form method="post" className="flex flex-col gap-6" onSubmit={next}>
      <AuthNotice result={notice} />
      <div className={details ? "hidden" : "flex flex-col gap-6"}>
        <div className="grid gap-6 md:grid-cols-2">
          <AuthField
            label={t("account.firstName")}
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
            defaultValue={result?.firstName}
          />
          <AuthField
            label={t("account.lastName")}
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={100}
            defaultValue={result?.lastName}
          />
        </div>
        <AuthField
          label={t("account.email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={result?.email}
          invalid={notice?.field === "email"}
        />
        <AuthField
          label={t("account.password")}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
          required
          help={t("account.passwordHelp")}
          invalid={notice?.field === "password"}
        />
      </div>
      {details && (
        <fieldset className="border-border flex min-w-0 flex-col gap-4 border-t pt-6">
          <legend className="sr-only">{t("account.purchase.title")}</legend>
          <div className="flex flex-col gap-2">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="typo-product-option-label text-on-surface"
            >
              {t("account.purchase.title")}
            </h2>
            <p className="typo-body-sm text-on-surface-secondary">
              {t("account.purchase.description")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <label
                htmlFor="purchase-region"
                className="typo-control-label-strong"
              >
                {t("account.purchase.region")} ({t("account.purchase.optional")}
                )
              </label>
              <select
                id="purchase-region"
                name="purchaseRegion"
                className={authInputClass}
                aria-invalid={notice?.field === "purchaseRegion" || undefined}
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                  setChannel("");
                }}
              >
                <option value="">{t("account.purchase.choose")}</option>
                {(["NA", "EU", "APAC"] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(`account.purchase.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <label
                htmlFor="purchase-channel"
                className="typo-control-label-strong"
              >
                {t("account.purchase.channel")} (
                {t("account.purchase.optional")})
              </label>
              <select
                id="purchase-channel"
                name="purchaseChannel"
                className={authInputClass}
                aria-invalid={notice?.field === "purchaseChannel" || undefined}
                disabled={!region}
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              >
                <option value="">{t("account.purchase.choose")}</option>
                {availableChannels.map((value) => (
                  <option key={value} value={value}>
                    {t(`account.channel.${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}
      <div
        className={
          details
            ? "hidden"
            : "typo-body-sm text-on-surface-secondary border-border flex flex-col gap-4 border-t pt-6"
        }
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className={checkboxClass}
            type="checkbox"
            name="ageConsent"
            required
          />
          <span>{t("account.ageConsent")}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className={checkboxClass}
            type="checkbox"
            name="termsConsent"
            required
          />
          <span>
            {t("account.terms.before")}{" "}
            <a
              className="text-on-surface hover:text-accent underline underline-offset-4"
              href={`${storefrontOrigin}/pages/satellai-app-terms-conditions`}
              target="_blank"
              rel="noreferrer"
            >
              {t("account.terms.link")}
            </a>{" "}
            {t("account.terms.and")}{" "}
            <a
              className="text-on-surface hover:text-accent underline underline-offset-4"
              href={`${storefrontOrigin}/pages/satellai-app-privacy-policy`}
              target="_blank"
              rel="noreferrer"
            >
              {t("account.privacy.link")}
            </a>
            .
          </span>
        </label>
      </div>
      {details ? (
        <div className="flex flex-col gap-3">
          <AuthSubmit>{t("account.signUp")}</AuthSubmit>
          <AuthSubmit name="intent" value="skip" variant="outline">
            {t("account.register.skip")}
          </AuthSubmit>
          <Button variant="light" onClick={() => setDetails(false)}>
            {t("account.register.back")}
          </Button>
        </div>
      ) : (
        <AuthSubmit name="intent" value="next">
          {t("account.register.next")}
        </AuthSubmit>
      )}
      <noscript className="typo-body-sm text-on-surface-secondary">
        {t("account.register.enableJavaScript")}
      </noscript>
      <p className="typo-body-sm text-on-surface-secondary text-center">
        {t("account.hasAccount")}{" "}
        <Link
          to="/account/login"
          className="text-on-surface hover:text-accent font-semibold underline underline-offset-4"
        >
          {t("account.signIn")}
        </Link>
      </p>
    </Form>
  );
}
