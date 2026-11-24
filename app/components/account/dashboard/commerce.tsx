import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Package } from "lucide-react";
import { Button, ButtonLink, Dialog, Pagination } from "~/components/ui";
import { useTranslations, useLocale } from "~/i18n";
import type { CommerceData, CommerceCustomer } from "~/lib/account";
import { ORDERS_PAGE_SIZE } from "~/lib/account/types";
import { cn } from "~/utils/cn";
import { formatPrice } from "~/utils/money";
import { AuthField } from "../auth-controls";
import {
  Empty,
  Feedback,
  Heading,
  parsePage,
  Status,
  Submit,
  useAccountMutation,
  useDisplayDate,
} from "./common";
type Order = CommerceCustomer["orders"]["nodes"][number];
type OrderImage = NonNullable<
  NonNullable<Order["lineItems"]["nodes"][number]["variant"]>["image"]
>;
export function CommerceUnavailable({
  state,
}: {
  state: CommerceData["state"];
}) {
  const t = useTranslations("account");
  return (
    <div className="flex flex-col items-start gap-4">
      <Empty error>
        {t(
          state === "unavailable"
            ? "account.dashboard.reconnect"
            : "account.dashboard.unavailable",
        )}
      </Empty>
      <ButtonLink variant="outline" href="/account/login?reauth=1">
        {t("account.dashboard.signInAgain")}
      </ButtonLink>
    </div>
  );
}
export function Orders({ commerce }: { commerce: CommerceData }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const date = useDisplayDate();
  const [search] = useSearchParams();
  const orders = commerce.customer?.orders;
  const [selected, setSelected] = useState<Order | null>(null);
  function statusEntries(order: Order): [string, ReactNode][] {
    return [
      [
        t("account.dashboard.paymentStatus"),
        <Status key="payment" value={order.financialStatus ?? ""} />,
      ],
      [
        t("account.dashboard.fulfillmentStatus"),
        <Status key="fulfillment" value={order.fulfillmentStatus ?? ""} />,
      ],
    ];
  }
  return (
    <section className="flex flex-col gap-6">
      <Heading title={t("account.dashboard.orders")} />
      {!commerce.customer ? (
        <CommerceUnavailable state={commerce.state} />
      ) : !orders?.nodes.length ? (
        <Empty>{t("account.dashboard.emptyOrders")}</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.nodes.map((order) => (
            <article
              key={order.id}
              className="border-border grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-4 rounded-2xl border p-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_20rem_6.5rem_auto] sm:gap-x-6 sm:p-6"
            >
              <OrderThumbnail order={order} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="typo-product-option-label">{order.name}</h3>
                <p className="typo-body-sm text-on-surface-secondary">
                  {date(order.processedAt)} · {itemCountLabel(t, order)}
                </p>
              </div>
              <dl className="typo-body-sm col-span-2 flex flex-wrap gap-x-6 gap-y-3 sm:col-span-1 sm:grid sm:grid-cols-2 sm:gap-x-4">
                {statusEntries(order).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-2">
                    <dt className="text-on-surface-secondary">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="col-span-2 flex items-center justify-between gap-4 sm:contents">
                <p className="typo-price-plan sm:justify-self-end">
                  {formatPrice(order.totalPrice, locale)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:justify-self-end"
                  onClick={() => setSelected(order)}
                >
                  {t("account.dashboard.items")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {orders ? (
        <OrderPagination
          pageInfo={orders.pageInfo}
          totalCount={orders.totalCount}
          search={search}
        />
      ) : null}
      {selected ? (
        <OrderDetails
          order={selected}
          close={() => setSelected(null)}
          statusEntries={statusEntries}
        />
      ) : null}
    </section>
  );
}

function OrderDetails({
  order,
  close,
  statusEntries,
}: {
  order: Order;
  close: () => void;
  statusEntries: (order: Order) => [string, ReactNode][];
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const date = useDisplayDate();
  const totals: [string, ReactNode][] = [];
  if (order.subtotalPrice)
    totals.push([
      t("account.dashboard.subtotal"),
      formatPrice(order.subtotalPrice, locale),
    ]);
  if (Number(order.totalShippingPrice.amount) > 0)
    totals.push([
      t("account.dashboard.shipping"),
      formatPrice(order.totalShippingPrice, locale),
    ]);
  if (order.totalTax && Number(order.totalTax.amount) > 0)
    totals.push([
      t("account.dashboard.tax"),
      formatPrice(order.totalTax, locale),
    ]);
  return (
    <Dialog
      open
      onClose={close}
      title={order.name}
      className="w-[min(46rem,calc(100%-2rem))]"
    >
      <div className="flex flex-col gap-6">
        <div className="bg-surface-secondary flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <p className="typo-body-sm text-on-surface-secondary">
            {date(order.processedAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            {statusEntries(order).map(([label, value]) => (
              <span key={label}>{value}</span>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-3">
          <h3 className="typo-overline text-on-surface-secondary">
            {t("account.dashboard.itemsTitle", {
              count: order.lineItems.nodes.length,
            })}
          </h3>
          <ul className="border-border divide-border flex flex-col divide-y overflow-hidden rounded-2xl border">
            {order.lineItems.nodes.map((item, index) => (
              <OrderLine key={`${item.title}-${index}`} item={item} />
            ))}
          </ul>
        </section>
        <dl className="typo-body-sm flex flex-col gap-3">
          {totals.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-on-surface-secondary">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="border-border flex items-center justify-between gap-4 border-t pt-3">
            <dt className="typo-body font-semibold">
              {t("account.dashboard.total")}
            </dt>
            <dd className="typo-body font-semibold">
              {formatPrice(order.totalPrice, locale)}
            </dd>
          </div>
        </dl>
        <ButtonLink href={order.statusUrl} variant="outline" className="w-full">
          {t("account.dashboard.viewOrder")}
        </ButtonLink>
      </div>
    </Dialog>
  );
}

function OrderLine({ item }: { item: Order["lineItems"]["nodes"][number] }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const variantTitle =
    item.variant?.title && item.variant.title !== "Default Title"
      ? item.variant.title
      : null;
  return (
    <li className="flex items-start gap-4 px-4 py-4">
      <ProductImage
        image={item.variant?.image}
        label={variantTitle || item.title}
        className="size-16 shrink-0 rounded-xl"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="typo-body font-semibold">{item.title}</p>
        {variantTitle ? (
          <p className="typo-body-sm text-on-surface-secondary">
            {variantTitle}
          </p>
        ) : null}
        <p className="typo-body-sm text-on-surface-secondary">
          {t("account.dashboard.quantity")} {item.quantity}
          {item.quantity > 1
            ? ` · ${formatPrice(unitPrice(item), locale)}`
            : null}
        </p>
      </div>
      <p className="typo-body shrink-0 font-semibold">
        {formatPrice(item.originalTotalPrice, locale)}
      </p>
    </li>
  );
}

function unitPrice(item: Order["lineItems"]["nodes"][number]) {
  const { amount, currencyCode } = item.originalTotalPrice;
  const quantity = item.quantity || 1;
  return {
    amount: (Number(amount) / quantity).toFixed(2),
    currencyCode,
  };
}

function ProductImage({
  image,
  label,
  className,
}: {
  image: OrderImage | null | undefined;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-surface-secondary text-on-surface-secondary flex items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
    >
      {image?.url ? (
        <img
          src={image.url}
          alt={image.altText || label}
          width={image.width ?? 160}
          height={image.height ?? 160}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <Package aria-hidden="true" className="size-6" />
      )}
    </span>
  );
}

/** Fixed-size thumbnail keeps every order row aligned; extra items become a badge. */
function OrderThumbnail({ order }: { order: Order }) {
  const items = order.lineItems.nodes;
  const image = items.find((item) => item.variant?.image?.url)?.variant?.image;
  const extra = items.length - 1;
  return (
    <span className="relative size-14">
      <ProductImage
        image={image}
        label={items[0]?.title ?? order.name}
        className="size-14"
      />
      {extra > 0 ? (
        <span
          aria-hidden="true"
          className="border-surface bg-surface text-on-surface typo-body-xs absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 font-semibold"
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function itemCountLabel(
  t: ReturnType<typeof useTranslations<"account">>,
  order: Order,
) {
  const count = order.lineItems.nodes.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  return t(
    count === 1
      ? "account.dashboard.itemOne"
      : "account.dashboard.itemsCount",
    { count },
  );
}

function OrderPagination({
  pageInfo,
  totalCount,
  search,
}: {
  pageInfo: CommerceCustomer["orders"]["pageInfo"];
  totalCount: string | number;
  search: URLSearchParams;
}) {
  const t = useTranslations("account");
  const firstHref = "/account?tab=orders";
  const after = search.get("after");
  const before = after ? null : search.get("before");
  const { hasNextPage, hasPreviousPage, startCursor, endCursor } = pageInfo;
  const total = Number(totalCount) || 0;
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  if (pageCount <= 1) return null;
  const wantsLastPage = !after && !before && search.get("page") === "last";
  const current = wantsLastPage
    ? pageCount
    : after || (before && hasPreviousPage)
      ? parsePage(search.get("page"))
      : 1;
  const pageHref = (
    direction: "after" | "before",
    cursor: string,
    page?: number,
  ) => {
    const params = new URLSearchParams({ [direction]: cursor });
    if (page) params.set("page", String(page));
    return `${firstHref}&${params}`;
  };
  const previousHref =
    (after || hasPreviousPage) && startCursor
      ? current === 2
        ? firstHref
        : pageHref("before", startCursor, current && current - 1)
      : undefined;
  const nextHref =
    (wantsLastPage ? false : before || hasNextPage) && endCursor
      ? pageHref("after", endCursor, current && current + 1)
      : undefined;
  const pages = current ? [{ page: current, href: `/account?${search}` }] : [];
  if (current && previousHref)
    pages.unshift({ page: current - 1, href: previousHref });
  if (current && nextHref) pages.push({ page: current + 1, href: nextHref });
  return (
    <Pagination
      pages={pages}
      currentPage={current}
      totalPages={pageCount}
      firstHref={current === 1 ? undefined : firstHref}
      lastHref={current === pageCount ? undefined : `${firstHref}&page=last`}
      previousHref={previousHref}
      nextHref={nextHref}
    />
  );
}
export function Profile({
  commerce,
  email,
}: {
  commerce: CommerceData;
  email: string;
}) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation();
  return (
    <section className="flex flex-col gap-6">
      <Heading
        title={t("account.dashboard.profile")}
        description={t("account.dashboard.profileNote")}
      />
      {!commerce.customer ? (
        <CommerceUnavailable state={commerce.state} />
      ) : (
        <fetcher.Form
          method="post"
          action="/account"
          className="flex max-w-xl flex-col gap-6"
        >
          <input type="hidden" name="intent" value="profile" />
          <Feedback result={fetcher.data} />
          <AuthField
            label={t("account.firstName")}
            name="firstName"
            required
            defaultValue={commerce.customer.firstName || ""}
            autoComplete="given-name"
            maxLength={100}
          />
          <AuthField
            label={t("account.lastName")}
            name="lastName"
            required
            defaultValue={commerce.customer.lastName || ""}
            autoComplete="family-name"
            maxLength={100}
          />
          <AuthField
            label={t("account.email")}
            name="email"
            readOnly
            value={email}
            type="email"
          />
          <AuthField
            label={t("account.dashboard.phone")}
            name="phone"
            type="tel"
            defaultValue={commerce.customer.phone || ""}
            autoComplete="tel"
            maxLength={50}
          />
          <Submit pending={fetcher.state !== "idle"}>
            {t("account.dashboard.save")}
          </Submit>
        </fetcher.Form>
      )}
    </section>
  );
}
