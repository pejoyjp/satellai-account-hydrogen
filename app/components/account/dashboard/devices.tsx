import { useEffect, useState } from "react";
import { Button, ButtonLink, Dialog } from "~/components/ui";
import { useTranslations, useLocale } from "~/i18n";
import {
  canBind,
  canUnbind,
  canPurchase,
  type AccountData,
  type Device,
  type Subscription,
} from "~/lib/account";
import { shopifyImageUrl } from "~/utils/shopify-image";
import { formatMoney } from "@shopify/hydrogen";
import { authInputClass } from "../auth-controls";
import {
  Details,
  Empty,
  Feedback,
  Heading,
  PagedList,
  Status,
  Submit,
  useAccountMutation,
  useDisplayDate,
} from "./common";
const products = {
  d1: {
    title: "SATELLAI Collar",
    image:
      "https://cdn.shopify.com/s/files/1/0659/0178/9340/files/20251029-181903.png?v=1761733184",
  },
  t1: {
    title: "SATELLAI Collar Go",
    image:
      "https://cdn.shopify.com/s/files/1/0659/0178/9340/files/20251029-181912.png?v=1761733184",
  },
  s1: {
    title: "SATELLAI Tracker",
    image:
      "https://cdn.shopify.com/s/files/1/0659/0178/9340/files/20260723-095209.webp?v=1784771553",
  },
};
export function Devices({ account }: { account: AccountData }) {
  const t = useTranslations("account");
  return (
    <section className="flex flex-col gap-6">
      <Heading title={t("account.dashboard.devices")} />
      {account.devices.state !== "ready" ? (
        <Empty error>{t("account.dashboard.partial")}</Empty>
      ) : null}
      {!account.devices.items.length && account.devices.state === "ready" ? (
        <Empty>{t("account.dashboard.emptyDevices")}</Empty>
      ) : null}
      <PagedList items={account.devices.items}>
        {(start, end) => (
          <div className="grid gap-6 md:grid-cols-2">
            {account.devices.items.slice(start, end).map((device) => (
              <DeviceCard
                key={device.sn}
                device={device}
                subscriptions={account.subscriptions.items}
              />
            ))}
          </div>
        )}
      </PagedList>
    </section>
  );
}
function DeviceCard({
  device,
  subscriptions,
}: {
  device: Device;
  subscriptions: Subscription[];
}) {
  const t = useTranslations("account");
  const date = useDisplayDate();
  const [dialog, setDialog] = useState<"bind" | "unbind" | "plans" | null>(
    null,
  );
  return (
    <article className="border-border flex min-w-0 flex-col gap-6 rounded-2xl border p-6">
      <div className="flex items-center gap-4">
        <img
          src={shopifyImageUrl(products[device.type].image, { width: 240 })}
          alt={products[device.type].title}
          width={96}
          height={96}
          className="size-24 shrink-0 object-contain"
          loading="lazy"
        />
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="typo-product-option-label break-all">{device.name}</h3>
          <p className="typo-body-sm text-on-surface-secondary">
            {products[device.type].title}
          </p>
        </div>
      </div>
      <Details
        entries={[
          [t("account.dashboard.serial"), device.sn],
          [
            t("account.dashboard.contract"),
            device.contractId
              ? device.contractId.split("/").pop()
              : t("account.dashboard.noBinding"),
          ],
          ...(device.expiresAt
            ? [
                [t("account.dashboard.expires"), date(device.expiresAt)] as [
                  string,
                  string,
                ],
              ]
            : []),
        ]}
      />
      {!device.entitlementLoaded ? (
        <p className="typo-body-sm text-on-surface-secondary">
          {t("account.dashboard.unavailable")}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-3">
        {subscriptions.some((item) => canBind(device, item)) ? (
          <Button variant="outline" onClick={() => setDialog("bind")}>
            {t("account.dashboard.bind")}
          </Button>
        ) : null}
        {canUnbind(device, subscriptions) ? (
          <Button variant="outline" onClick={() => setDialog("unbind")}>
            {t("account.dashboard.unbind")}
          </Button>
        ) : null}
        {canPurchase(device) ? (
          <Button onClick={() => setDialog("plans")}>
            {t("account.dashboard.buyPlan")}
          </Button>
        ) : null}
        {device.trialCheckout && canPurchase(device) ? (
          <ButtonLink href={device.trialCheckout} variant="outline">
            {t("account.dashboard.claimTrial")}
          </ButtonLink>
        ) : null}
      </div>
      {dialog === "bind" ? (
        <Binding
          device={device}
          subscriptions={subscriptions}
          close={() => setDialog(null)}
        />
      ) : null}
      {dialog === "unbind" ? (
        <Unbinding device={device} close={() => setDialog(null)} />
      ) : null}
      {dialog === "plans" ? (
        <Plans device={device} close={() => setDialog(null)} />
      ) : null}
    </article>
  );
}
function Binding({
  device,
  subscriptions,
  close,
}: {
  device: Device;
  subscriptions: Subscription[];
  close: () => void;
}) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation(close);
  const available = subscriptions.filter((item) => canBind(device, item));
  const [selection, setSelection] = useState("");
  const selected = available[Number(selection)];
  return (
    <Dialog open onClose={close} title={t("account.dashboard.bind")}>
      <fetcher.Form
        method="post"
        action="/account"
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="intent" value="bind" />
        <input type="hidden" name="sn" value={device.sn} />
        <input type="hidden" name="contractId" value={selected?.id || ""} />
        <input type="hidden" name="siteKey" value={selected?.siteKey || ""} />
        <Feedback result={fetcher.data} />
        <label className="typo-control-label-strong flex flex-col gap-2">
          {t("account.dashboard.choosePlan")}
          <select
            className={authInputClass}
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
            required
          >
            <option value="">{t("account.purchase.choose")}</option>
            {available.map((item, index) => (
              <option key={`${item.siteKey}:${item.id}`} value={index}>
                {item.title} · {item.used}/{item.total} ·{" "}
                {item.id.split("/").pop()}
              </option>
            ))}
          </select>
        </label>
        <Submit
          pending={fetcher.state !== "idle"}
          disabled={selection === "" || !selected}
        >
          {t("account.dashboard.confirm")}
        </Submit>
      </fetcher.Form>
    </Dialog>
  );
}
function Unbinding({ device, close }: { device: Device; close: () => void }) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation(close);
  return (
    <Dialog open onClose={close} title={t("account.dashboard.unbind")}>
      <fetcher.Form
        method="post"
        action="/account"
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="intent" value="unbind" />
        <input type="hidden" name="sn" value={device.sn} />
        <p className="typo-body text-on-surface-secondary">
          {t("account.dashboard.unbindConfirm")}
        </p>
        <Feedback result={fetcher.data} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={close}>
            {t("account.dashboard.cancel")}
          </Button>
          <Submit pending={fetcher.state !== "idle"}>
            {t("account.dashboard.confirm")}
          </Submit>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
function Plans({ device, close }: { device: Device; close: () => void }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const fetcher = useAccountMutation();
  const submit = fetcher.submit;
  useEffect(() => {
    void submit(
      { intent: "plans", sn: device.sn },
      { method: "post", action: "/account" },
    );
  }, [submit, device.sn]);
  return (
    <Dialog open onClose={close} title={t("account.dashboard.buyPlan")}>
      <div className="flex flex-col gap-6">
        {fetcher.state !== "idle" || !fetcher.data ? (
          <p role="status" className="typo-body text-on-surface-secondary">
            {t("account.dashboard.loading")}
          </p>
        ) : null}
        <Feedback result={fetcher.data} />
        {fetcher.state === "idle" &&
          fetcher.data?.plans?.map((plan) => (
            <article
              key={plan.id}
              className="border-border flex flex-col gap-4 rounded-2xl border p-5"
            >
              <h3 className="typo-product-option-label">{plan.title}</h3>
              <p className="typo-body-sm text-on-surface-secondary">
                {plan.interval}
              </p>
              <p className="typo-price-plan">
                {plan.price && plan.currency
                  ? formatMoney(
                      { amount: plan.price, currencyCode: plan.currency },
                      { locale },
                    ).toString()
                  : "—"}
              </p>
              {plan.checkoutUrl ? (
                <ButtonLink href={plan.checkoutUrl}>
                  {t("account.dashboard.checkout")}
                </ButtonLink>
              ) : (
                <p className="typo-body-sm text-on-surface-secondary">
                  {t("account.dashboard.unavailable")}
                </p>
              )}
            </article>
          ))}
        {fetcher.data?.plans?.length === 0 ? (
          <Empty>{t("account.dashboard.noEligiblePlans")}</Empty>
        ) : null}
      </div>
    </Dialog>
  );
}
