import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Radio,
  CreditCard,
  Gift,
  Package,
  MapPin,
  UserRound,
  LogOut,
  RotateCw,
  CircleHelp,
} from "lucide-react";
import { Link, useRevalidator, useSearchParams } from "react-router";
import { Button, ButtonLink } from "~/components/ui";
import { useTranslations } from "~/i18n";
import type { AccountData, CommerceData } from "~/lib/account";
import { useStorefrontOrigin } from "~/lib/storefront-links";
import { cn } from "~/utils/cn";
import { Devices } from "./devices";
import { Subscriptions } from "./subscriptions";
import { Rewards } from "./rewards";
import { Orders, Profile } from "./commerce";
import { Addresses } from "./addresses";
import { Heading } from "./common";
const tabs = [
  { id: "overview", icon: LayoutDashboard },
  { id: "devices", icon: Radio },
  { id: "subscriptions", icon: CreditCard },
  { id: "rewards", icon: Gift },
  { id: "orders", icon: Package },
  { id: "addresses", icon: MapPin },
  { id: "profile", icon: UserRound },
] as const;
export function AccountDashboard({
  account,
  commerce,
  profile,
}: {
  account: AccountData;
  commerce: CommerceData;
  profile: { email: string; firstName: string; lastName: string };
}) {
  const t = useTranslations("account");
  const storefrontOrigin = useStorefrontOrigin();
  const [search] = useSearchParams();
  const revalidator = useRevalidator();
  const selected =
    tabs.find((tab) => tab.id === search.get("tab"))?.id || "overview";
  const panelRef = useRef<HTMLDivElement>(null);
  const previousTab = useRef(selected);
  useEffect(() => {
    if (previousTab.current === selected) return;
    previousTab.current = selected;
    panelRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [selected]);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="content-container pt-section pb-section flex-1"
    >
      <header className="border-border mb-8 flex flex-wrap items-end justify-between gap-6 border-b pb-8 md:mb-10">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="typo-overline text-on-surface-secondary">
            {t("account.eyebrow")}
          </p>
          <h1 className="typo-display md:typo-heading-2xl">
            {t("account.profile.title")}
          </h1>
          <p className="typo-body text-on-surface-secondary break-all">
            {[profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
              profile.email}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={revalidator.state !== "idle"}
          onClick={() => revalidator.revalidate()}
        >
          <RotateCw
            aria-hidden="true"
            className={cn(
              "size-4",
              revalidator.state !== "idle" && "loading-spin",
            )}
          />
          {t("account.dashboard.refresh")}
        </Button>
      </header>
      <div className="grid gap-8 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-12">
        <aside className="bg-surface sticky top-16 z-10 min-w-0 self-start xl:top-24">
          <nav
            aria-label={t("account.profile.title")}
            className="flex gap-2 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible"
          >
            {tabs.map(({ id, icon: Icon }) => (
              <Link
                key={id}
                to={`/account?tab=${id}`}
                preventScrollReset
                aria-current={selected === id ? "page" : undefined}
                className={cn(
                  "typo-body-sm focus-visible:outline-accent flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 font-semibold transition-colors duration-(--motion-overlay-duration) motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected === id
                    ? "bg-accent text-interactive-text"
                    : "bg-surface-secondary text-on-surface hover:bg-hover",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {t(`account.dashboard.${id}`)}
              </Link>
            ))}
          </nav>
          <form
            method="post"
            action="/account/logout"
            className="mt-4 hidden xl:block"
          >
            <Button
              variant="outline"
              size="sm"
              type="submit"
              className="w-full"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("account.signOut")}
            </Button>
          </form>
        </aside>
        <div ref={panelRef} className="min-w-0 scroll-mt-36 xl:scroll-mt-24">
          {selected === "overview" ? (
            <section className="flex flex-col gap-8">
              <Heading
                title={t("account.dashboard.overview")}
                description={t("account.dashboard.welcome")}
              />
              <div className="grid gap-4 md:grid-cols-3">
                {(
                  [
                    {
                      id: "devices",
                      count: account.devices.items.length,
                      ready: account.devices.state === "ready",
                    },
                    {
                      id: "subscriptions",
                      count: account.subscriptions.items.length,
                      ready: account.subscriptions.state === "ready",
                    },
                    {
                      id: "rewards",
                      count: account.rewards.items.filter(
                        (item) => item.status === "AVAILABLE",
                      ).length,
                      ready: account.rewards.state === "ready",
                    },
                  ] as const
                ).map(({ id, count, ready }) => (
                  <Link
                    key={id}
                    to={`/account?tab=${id}`}
                    preventScrollReset
                    className="border-border bg-surface-secondary hover:border-accent flex flex-col gap-4 rounded-2xl border p-6 transition-colors"
                  >
                    <p className="typo-body-sm text-on-surface-secondary">
                      {t(`account.dashboard.${id}`)}
                    </p>
                    <span className="typo-heading-2xl">
                      {ready ? count : "—"}
                    </span>
                  </Link>
                ))}
              </div>
              <Devices account={account} />
              <div className="border-border flex flex-col items-start gap-4 rounded-2xl border p-6">
                <CircleHelp aria-hidden="true" className="text-accent size-6" />
                <h3 className="typo-product-option-label">
                  {t("account.dashboard.help")}
                </h3>
                <ButtonLink
                  variant="outline"
                  href={`${storefrontOrigin}/a/faq`}
                >
                  {t("account.dashboard.help")}
                </ButtonLink>
              </div>
            </section>
          ) : selected === "devices" ? (
            <Devices account={account} />
          ) : selected === "subscriptions" ? (
            <Subscriptions account={account} />
          ) : selected === "rewards" ? (
            <Rewards account={account} />
          ) : selected === "orders" ? (
            <Orders commerce={commerce} />
          ) : selected === "addresses" ? (
            <Addresses commerce={commerce} />
          ) : (
            <Profile commerce={commerce} email={profile.email} />
          )}
        </div>
      </div>
      <form method="post" action="/account/logout" className="mt-8 xl:hidden">
        <Button type="submit" variant="outline" className="w-full">
          {t("account.signOut")}
        </Button>
      </form>
    </main>
  );
}
