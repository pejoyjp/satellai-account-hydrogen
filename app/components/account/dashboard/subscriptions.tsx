import { ButtonLink } from "~/components/ui";
import { useTranslations } from "~/i18n";
import type { AccountData } from "~/lib/account";
import {
  Details,
  Empty,
  Heading,
  PagedList,
  Status,
  useDisplayDate,
} from "./common";
export function Subscriptions({ account }: { account: AccountData }) {
  const t = useTranslations("account");
  const date = useDisplayDate();
  const section = account.subscriptions;
  return (
    <section className="flex flex-col gap-6">
      <Heading
        title={t("account.dashboard.subscriptions")}
        description={t("account.dashboard.portalNote")}
      />
      {section.state !== "ready" ? (
        <Empty error>{t("account.dashboard.unavailable")}</Empty>
      ) : null}
      {section.state === "ready" && !section.items.length ? (
        <Empty>{t("account.dashboard.emptySubscriptions")}</Empty>
      ) : null}
      <PagedList items={section.items}>
        {(start, end) => (
          <div className="grid gap-6 md:grid-cols-2">
            {section.items.slice(start, end).map((item) => (
              <article
                key={`${item.siteKey}:${item.id}`}
                className="border-border flex min-w-0 flex-col gap-6 rounded-2xl border p-6"
              >
                <Status value={item.status} />
                <h3 className="typo-product-option-label">
                  {item.title ||
                    (item.isLifeTimeCard
                      ? t("account.dashboard.lifetime")
                      : item.type.toUpperCase())}
                </h3>
                <Details
                  entries={[
                    [t("account.dashboard.contract"), item.id.split("/").pop()],
                    ...(item.price
                      ? [
                          [t("account.dashboard.total"), item.price] as [
                            string,
                            string,
                          ],
                        ]
                      : []),
                    [t("account.dashboard.frequency"), item.interval || "—"],
                    [
                      t(
                        item.isLifeTimeCard
                          ? "account.dashboard.expires"
                          : "account.dashboard.nextBilling",
                      ),
                      date(item.expiresAt || item.nextBillingDate),
                    ],
                    [
                      t("account.dashboard.capacity"),
                      `${item.used} / ${item.total}`,
                    ],
                  ]}
                />
                {item.devices.length ? (
                  <div className="typo-body-sm text-on-surface-secondary border-border flex flex-col gap-2 border-t pt-4">
                    {item.devices.map((sn) => (
                      <p key={sn} className="break-all">
                        {sn}
                      </p>
                    ))}
                  </div>
                ) : null}
                {item.manageUrl ? (
                  <ButtonLink
                    href={item.manageUrl}
                    variant="outline"
                    className="mt-auto"
                  >
                    {t("account.dashboard.manage")}
                  </ButtonLink>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PagedList>
    </section>
  );
}
