import { useState } from "react";
import { Button, ButtonLink, Dialog } from "~/components/ui";
import { useTranslations } from "~/i18n";
import {
  canPurchase,
  ownedSubscription,
  type AccountData,
  type Reward,
} from "~/lib/account";
import { AuthField, authInputClass } from "../auth-controls";
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
export function Rewards({ account }: { account: AccountData }) {
  const t = useTranslations("account");
  const date = useDisplayDate();
  const [selected, setSelected] = useState<Reward | null>(null);
  const checker = useAccountMutation((result) => {
    if (result.reward) setSelected(result.reward);
  });
  return (
    <section className="flex flex-col gap-6">
      <Heading title={t("account.dashboard.rewards")} />
      <checker.Form
        method="post"
        action="/account"
        className="border-border flex flex-col gap-4 rounded-2xl border p-6 md:flex-row md:items-end"
      >
        <input type="hidden" name="intent" value="reward-check" />
        <div className="min-w-0 flex-1">
          <AuthField
            name="code"
            label={t("account.dashboard.code")}
            required
            maxLength={128}
            autoComplete="off"
          />
        </div>
        <Submit pending={checker.state !== "idle"} size="lg">
          {t("account.dashboard.check")}
        </Submit>
      </checker.Form>
      <Feedback result={checker.data} />
      {account.rewards.state !== "ready" ? (
        <Empty error>{t("account.dashboard.unavailable")}</Empty>
      ) : null}
      {account.rewards.state === "ready" && !account.rewards.items.length ? (
        <Empty>{t("account.dashboard.emptyRewards")}</Empty>
      ) : null}
      <PagedList items={account.rewards.items}>
        {(start, end) => (
          <div className="grid gap-6 md:grid-cols-2">
            {account.rewards.items.slice(start, end).map((item) => (
              <article
                className="border-border flex min-w-0 flex-col gap-5 rounded-2xl border p-6"
                key={item.code}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="typo-product-option-label break-all">
                    {item.code}
                  </h3>
                  <Status value={item.status} />
                </div>
                <p className="typo-body text-on-surface-secondary">
                  {t(
                    item.type === "EXTEND_DURATION"
                      ? "account.dashboard.rewardExtend"
                      : "account.dashboard.rewardNew",
                  )}{" "}
                  ·{" "}
                  {{
                    d1: "SATELLAI Collar",
                    t1: "SATELLAI Collar Go",
                    s1: "SATELLAI Tracker",
                  }[item.productType] || item.productType}
                  {item.months
                    ? ` · ${item.months} ${t(item.months === 1 ? "account.dashboard.month" : "account.dashboard.months")}`
                    : ""}
                </p>
                {item.expiresAt || item.redeemedAt ? (
                  <Details
                    entries={[
                      [t("account.dashboard.expires"), date(item.expiresAt)],
                      [t("account.dashboard.date"), date(item.redeemedAt)],
                    ]}
                  />
                ) : null}
                {item.status.toUpperCase() === "AVAILABLE" ? (
                  <Button
                    variant="outline"
                    className="mt-auto"
                    disabled={checker.state !== "idle"}
                    onClick={() =>
                      checker.submit(
                        { intent: "reward-check", code: item.code },
                        { method: "post", action: "/account" },
                      )
                    }
                  >
                    {t("account.dashboard.redeem")}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PagedList>
      {selected ? (
        <RedeemDialog
          reward={selected}
          account={account}
          close={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
function RedeemDialog({
  reward,
  account,
  close,
}: {
  reward: Reward;
  account: AccountData;
  close: () => void;
}) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation();
  const [sn, setSn] = useState("");
  const extending = reward.type === "EXTEND_DURATION";
  const devices = account.devices.items.filter(
    (device) =>
      device.type === reward.productType &&
      (extending
        ? !!account.subscriptions.items.find(
            (sub) =>
              sub ===
                ownedSubscription(
                  account.subscriptions.items,
                  device.contractId || "",
                  device.siteKey,
                ) &&
              sub.status.toUpperCase() === "ACTIVE" &&
              !sub.isLifeTimeCard &&
              sub.devices.includes(device.sn),
          )
        : canPurchase(device)),
  );
  const device = devices.find((item) => item.sn === sn);
  const subscription = device?.contractId
    ? ownedSubscription(
        account.subscriptions.items,
        device.contractId,
        device.siteKey,
      )
    : null;
  return (
    <Dialog open title={t("account.dashboard.redeem")} onClose={close}>
      <fetcher.Form
        method="post"
        action="/account"
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="intent" value="reward-redeem" />
        <input type="hidden" name="code" value={reward.code} />
        <input type="hidden" name="contractId" value={subscription?.id || ""} />
        <input
          type="hidden"
          name="siteKey"
          value={subscription?.siteKey || ""}
        />
        <p className="typo-product-option-label break-all">{reward.code}</p>
        <p className="typo-body text-on-surface-secondary">
          {t("account.dashboard.redeemConfirm")}
        </p>
        <Feedback result={fetcher.data} />
        {fetcher.data?.checkoutUrl ? (
          <ButtonLink href={fetcher.data.checkoutUrl} size="lg">
            {t("account.dashboard.checkout")}
          </ButtonLink>
        ) : fetcher.data?.ok ? null : devices.length ? (
          <>
            <label className="typo-control-label-strong flex flex-col gap-2">
              {t("account.dashboard.selectDevice")}
              <select
                name="sn"
                required
                className={authInputClass}
                value={sn}
                onChange={(event) => setSn(event.target.value)}
              >
                <option value="">{t("account.purchase.choose")}</option>
                {devices.map((item) => (
                  <option key={item.sn} value={item.sn}>
                    {item.sn}
                  </option>
                ))}
              </select>
            </label>
            <Submit pending={fetcher.state !== "idle"} disabled={!device}>
              {t("account.dashboard.confirm")}
            </Submit>
          </>
        ) : (
          <Empty>{t("account.dashboard.noEligibleDevices")}</Empty>
        )}
      </fetcher.Form>
    </Dialog>
  );
}
