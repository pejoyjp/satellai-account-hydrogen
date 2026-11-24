import { Link } from "react-router";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "~/utils/cn";
import { useTranslations } from "~/i18n";

/** Circles keep a 44px tap target while staying visually light. */
const paginationControl = cva(
  "inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-0 typo-button-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
  {
    variants: {
      tone: {
        idle: "bg-surface-secondary text-on-surface hover:bg-border",
        active: "bg-accent text-interactive-text",
        /** Ghosted ring keeps unavailable arrows visible but clearly inert. */
        muted: "border border-border bg-transparent text-disabled-text",
      },
    },
    defaultVariants: { tone: "idle" },
  },
);

export type PaginationLink = { page: number; href: string };
export type PaginationProps = {
  /** Pages whose destination is known. Unknown pages collapse into an ellipsis. */
  pages?: PaginationLink[];
  currentPage?: number;
  totalPages?: number;
  previousHref?: string | null;
  nextHref?: string | null;
  /**
   * First/last page shortcuts. They are not rendered as extra arrows; the page
   * numbers themselves stay clickable when a destination is known.
   */
  firstHref?: string | null;
  lastHref?: string | null;
  pending?: boolean;
  className?: string;
  onNext?: (event: MouseEvent<HTMLAnchorElement>) => void;
  preventScrollReset?: boolean;
};

/**
 * List the page numbers worth showing: the first and last page plus a window
 * around the current one. Numbers without a known destination are dropped and
 * later rendered as an ellipsis, so every visible number is a real link.
 */
export function paginationSequence(
  links: PaginationLink[],
  currentPage?: number,
  totalPages?: number,
  radius = 2,
): (number | "gap")[] {
  const hrefs = new Map<number, string>();
  for (const { page, href } of links) {
    if (Number.isSafeInteger(page) && page > 0) hrefs.set(page, href);
  }
  const numbers = [...hrefs.keys()]
    .filter((page) => totalPages === undefined || page <= totalPages)
    .filter(
      (page) =>
        currentPage === undefined ||
        totalPages === undefined ||
        page === 1 ||
        page === totalPages ||
        Math.abs(page - currentPage) <= radius,
    )
    .sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  numbers.forEach((page, index) => {
    const previous = numbers[index - 1];
    if (previous !== undefined && page - previous > 1) items.push("gap");
    items.push(page);
  });
  return items;
}

export function Pagination({
  pages,
  currentPage,
  totalPages,
  previousHref,
  nextHref,
  firstHref,
  lastHref,
  pending = false,
  className,
  onNext,
  preventScrollReset,
}: PaginationProps) {
  const t = useTranslations("common");
  const links = [...(pages ?? [])];
  // First/last are registered before `pages` so an explicit link (which may
  // carry a cursor) wins over these shortcuts.
  if (lastHref && totalPages && totalPages > 1)
    links.unshift({ page: totalPages, href: lastHref });
  if (firstHref) links.unshift({ page: 1, href: firstHref });
  const hrefs = new Map(links.map(({ page, href }) => [page, href]));
  const sequence = paginationSequence(links, currentPage, totalPages);
  if (!sequence.length) return null;
  const icon = "size-4";
  return (
    <nav
      aria-label={t("common.pagination")}
      aria-busy={pending}
      className={cn(
        "mt-10 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-8",
        className,
      )}
    >
      {previousHref ? (
        <Link
          aria-label={t("common.previous")}
          rel="prev"
          to={previousHref}
          className={paginationControl()}
          preventScrollReset={preventScrollReset}
        >
          <ChevronLeft aria-hidden="true" className={icon} />
        </Link>
      ) : (
        <span aria-disabled="true" className={paginationControl({ tone: "muted" })}>
          <ChevronLeft aria-hidden="true" className={icon} />
          <span className="sr-only">{t("common.previous")}</span>
        </span>
      )}
      <ol className="flex flex-wrap items-center justify-center gap-1">
        {sequence.map((item) =>
          item === "gap" ? (
            <li key="gap" aria-hidden="true">
              <span className="text-on-surface-secondary inline-flex size-7 items-center justify-center">
                …
              </span>
            </li>
          ) : item === currentPage ? (
            <li key={item}>
              <span
                aria-current="page"
                className={paginationControl({ tone: "active" })}
              >
                {item}
              </span>
            </li>
          ) : (
            <li key={item}>
              <Link
                to={hrefs.get(item) ?? "#"}
                aria-label={t("common.pageOf", {
                  page: item,
                  total: totalPages ?? item,
                })}
                className={paginationControl()}
                preventScrollReset={preventScrollReset}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      {nextHref ? (
        <Link
          aria-label={t("common.next")}
          rel="next"
          to={nextHref}
          aria-disabled={pending || undefined}
          className={cn(paginationControl(), pending && "cursor-wait opacity-60")}
          preventScrollReset={preventScrollReset}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
              return;
            }
            onNext?.(event);
          }}
        >
          <ChevronRight aria-hidden="true" className={icon} />
        </Link>
      ) : (
        <span aria-disabled="true" className={paginationControl({ tone: "muted" })}>
          <ChevronRight aria-hidden="true" className={icon} />
          <span className="sr-only">{t("common.next")}</span>
        </span>
      )}
    </nav>
  );
}
