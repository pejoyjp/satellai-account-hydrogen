import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { LoaderCircle } from "lucide-react";
import { Button, Pagination, type ButtonProps } from "~/components/ui";
import { useLocale, useTranslations } from "~/i18n";
import type { TranslationKey } from "~/i18n";
import type { AccountActionResult } from "~/lib/account";
import { cn } from "~/utils/cn";
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="typo-product-title text-on-surface">{title}</h2>
        {description ? (
          <p className="typo-body text-on-surface-secondary max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? "status" : undefined}
      className={cn(
        "typo-body border-border rounded-2xl border p-6",
        error
          ? "text-critical bg-critical/5"
          : "text-on-surface-secondary bg-surface-secondary",
      )}
    >
      {children}
    </p>
  );
}
export function useAccountMutation(
  onSuccess?: (result: AccountActionResult) => void,
) {
  const fetcher = useFetcher<AccountActionResult>();
  const latest = useRef(onSuccess);
  latest.current = onSuccess;
  const handled = useRef<AccountActionResult | undefined>(undefined);
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data?.ok &&
      fetcher.data !== handled.current
    ) {
      handled.current = fetcher.data;
      latest.current?.(fetcher.data);
    }
  }, [fetcher.state, fetcher.data]);
  return fetcher;
}
export function Feedback({ result }: { result?: AccountActionResult }) {
  const t = useTranslations("account");
  if (!result || result.plans || result.reward) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={cn(
        "typo-body-sm rounded-xl border p-4",
        result.ok
          ? "text-success border-success/20 bg-success/5"
          : "text-critical border-critical/20 bg-critical/5",
      )}
    >
      {t(`account.dashboard.${result.ok ? "saved" : result.error || "failed"}`)}
    </p>
  );
}
export function Submit({
  pending,
  children,
  ...props
}: ButtonProps & { pending: boolean }) {
  const t = useTranslations("account");
  return (
    <Button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={cn("disabled:aria-busy:opacity-85", props.className)}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="loading-spin size-5" />
          <span>{t("account.dashboard.loading")}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
export function useDisplayDate() {
  const locale = useLocale();
  return (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(date);
  };
}
const statuses = new Set([
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
  "AVAILABLE",
  "REDEEMED",
  "USED",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "VOIDED",
  "FULFILLED",
  "IN_PROGRESS",
  "ON_HOLD",
  "OPEN",
  "PARTIALLY_FULFILLED",
  "PENDING_FULFILLMENT",
  "RESTOCKED",
  "SCHEDULED",
  "UNFULFILLED",
]);
export function Status({ value }: { value: string }) {
  const t = useTranslations("account");
  const upper = value.toUpperCase();
  return (
    <span
      className={cn(
        "typo-body-xs inline-flex w-fit rounded-full px-3 py-1 font-semibold",
        ["ACTIVE", "AVAILABLE", "PAID", "FULFILLED"].includes(upper)
          ? "bg-success/10 text-success"
          : "bg-surface-secondary text-on-surface-secondary",
      )}
    >
      {statuses.has(upper)
        ? t(`account.dashboard.${upper}` as TranslationKey<"account">)
        : value || "—"}
    </span>
  );
}
export function Details({ entries }: { entries: [string, ReactNode][] }) {
  return (
    <dl className="typo-body-sm flex flex-col gap-3">
      {entries.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-wrap justify-between gap-x-4 gap-y-1"
        >
          <dt className="text-on-surface-secondary">{label}</dt>
          <dd className="text-on-surface break-all text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : undefined;
}
export function PagedList({
  items,
  children,
  pageSize = 8,
}: {
  items: unknown[];
  children: (start: number, end: number) => ReactNode;
  pageSize?: number;
}) {
  const [search] = useSearchParams();
  const pageCount = Math.ceil(items.length / pageSize);
  const current = Math.min(
    parsePage(search.get("page")) ?? 1,
    Math.max(1, pageCount),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const previousPage = useRef(current);
  useEffect(() => {
    if (previousPage.current === current) return;
    previousPage.current = current;
    listRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [current]);
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const params = new URLSearchParams(search);
    if (page === 1) params.delete("page");
    else params.set("page", String(page));
    return { page, href: `/account${params.size ? `?${params}` : ""}` };
  });
  return (
    <>
      <div ref={listRef} className="scroll-mt-36 xl:scroll-mt-24">
        {children((current - 1) * pageSize, current * pageSize)}
      </div>
      {pageCount > 1 ? (
        <Pagination
          pages={pages}
          currentPage={current}
          totalPages={pageCount}
          firstHref={current === 1 ? undefined : pages[0]?.href}
          lastHref={
            current === pageCount ? undefined : pages[pageCount - 1]?.href
          }
          previousHref={pages[current - 2]?.href}
          nextHref={pages[current]?.href}
          preventScrollReset
        />
      ) : null}
    </>
  );
}
