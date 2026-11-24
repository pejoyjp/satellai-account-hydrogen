import type { ReactNode } from "react";
import { useTranslations } from "~/i18n";
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const t = useTranslations("account");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="content-container pt-section pb-section flex-1"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 md:gap-10">
        <header className="flex flex-col gap-3 text-center">
          <p className="typo-overline text-on-surface-secondary">
            {t("account.eyebrow")}
          </p>
          <h1 className="typo-display md:typo-heading-2xl text-on-surface">
            {title}
          </h1>
          <p className="typo-body text-on-surface-secondary">{description}</p>
        </header>
        {children}
      </div>
    </main>
  );
}
