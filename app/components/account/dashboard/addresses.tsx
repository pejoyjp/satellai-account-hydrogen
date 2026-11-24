import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button, Dialog } from "~/components/ui";
import { useTranslations, type TranslationKey } from "~/i18n";
import type { CommerceData, CommerceCustomer } from "~/lib/account";
import { AuthField } from "../auth-controls";
import { CommerceUnavailable } from "./commerce";
import { Empty, Feedback, Heading, Submit, useAccountMutation } from "./common";
type Address = CommerceCustomer["addresses"]["nodes"][number];
export function Addresses({ commerce }: { commerce: CommerceData }) {
  const t = useTranslations("account");
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const defaults = useAccountMutation();
  return (
    <section className="flex flex-col gap-6">
      <Heading
        title={t("account.dashboard.addresses")}
        action={
          commerce.customer ? (
            <Button onClick={() => setEditing("new")}>
              {t("account.dashboard.addAddress")}
            </Button>
          ) : null
        }
      />
      <Feedback result={defaults.data} />
      {!commerce.customer ? (
        <CommerceUnavailable state={commerce.state} />
      ) : !commerce.customer.addresses.nodes.length ? (
        <Empty>{t("account.dashboard.emptyAddresses")}</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {commerce.customer.addresses.nodes.map((address) => {
            const isDefault =
              address.id === commerce.customer?.defaultAddress?.id;
            return (
              <article
                key={address.id}
                className="border-border flex min-w-0 flex-col gap-5 rounded-2xl border p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="typo-product-option-label">
                    {[address.firstName, address.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </h3>
                  {isDefault ? (
                    <span className="typo-body-xs text-accent bg-accent/10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                      <Check aria-hidden="true" className="size-3.5" />
                      {t("account.dashboard.defaultAddress")}
                    </span>
                  ) : null}
                </div>
                <address className="typo-body text-on-surface-secondary flex flex-col gap-1 not-italic">
                  {[
                    address.company,
                    address.address1,
                    address.address2,
                    [address.city, address.province, address.zip]
                      .filter(Boolean)
                      .join(", "),
                    address.country,
                    address.phone,
                  ]
                    .filter(Boolean)
                    .map((line, index) => (
                      <p key={index} className="break-words">
                        {line}
                      </p>
                    ))}
                </address>
                <div className="border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => setEditing(address)}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    {t("account.dashboard.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-critical hover:bg-critical/10"
                    onClick={() => setDeleting(address)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t("account.dashboard.remove")}
                  </Button>
                  {isDefault ? null : (
                    <defaults.Form
                      method="post"
                      action="/account"
                      className="sm:ml-auto"
                    >
                      <input
                        type="hidden"
                        name="intent"
                        value="address-default"
                      />
                      <input type="hidden" name="id" value={address.id} />
                      <Submit
                        variant="outline"
                        size="sm"
                        pending={defaults.state !== "idle"}
                      >
                        <Check aria-hidden="true" className="size-4" />
                        {t("account.dashboard.makeDefault")}
                      </Submit>
                    </defaults.Form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing ? (
        <AddressEditor
          key={editing === "new" ? "new" : editing.id}
          address={editing === "new" ? null : editing}
          close={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <AddressDelete address={deleting} close={() => setDeleting(null)} />
      ) : null}
    </section>
  );
}
function AddressEditor({
  address,
  close,
}: {
  address: Address | null;
  close: () => void;
}) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation(close);
  const fields = [
    ["firstName", "account.firstName", "given-name"],
    ["lastName", "account.lastName", "family-name"],
    ["company", "account.dashboard.company", "organization"],
    ["address1", "account.dashboard.address1", "address-line1"],
    ["address2", "account.dashboard.address2", "address-line2"],
    ["city", "account.dashboard.city", "address-level2"],
    ["province", "account.dashboard.province", "address-level1"],
    ["country", "account.dashboard.country", "country-name"],
    ["zip", "account.dashboard.zip", "postal-code"],
    ["phone", "account.dashboard.phone", "tel"],
  ] as const;
  return (
    <Dialog
      open
      onClose={close}
      title={t(
        address ? "account.dashboard.edit" : "account.dashboard.addAddress",
      )}
    >
      <fetcher.Form
        method="post"
        action="/account"
        className="flex flex-col gap-5"
      >
        <input
          type="hidden"
          name="intent"
          value={address ? "address-update" : "address-create"}
        />
        <input type="hidden" name="id" value={address?.id || ""} />
        <Feedback result={fetcher.data} />
        {fields.map(([name, label, autoComplete]) => (
          <AuthField
            key={name}
            name={name}
            label={t(label)}
            defaultValue={address?.[name] || ""}
            autoComplete={autoComplete}
            type={name === "phone" ? "tel" : "text"}
            maxLength={200}
            required={[
              "firstName",
              "lastName",
              "address1",
              "city",
              "country",
              "zip",
            ].includes(name)}
          />
        ))}
        <Submit pending={fetcher.state !== "idle"}>
          {t("account.dashboard.save")}
        </Submit>
      </fetcher.Form>
    </Dialog>
  );
}
function AddressDelete({
  address,
  close,
}: {
  address: Address;
  close: () => void;
}) {
  const t = useTranslations("account");
  const fetcher = useAccountMutation(close);
  return (
    <Dialog open onClose={close} title={t("account.dashboard.remove")}>
      <fetcher.Form
        method="post"
        action="/account"
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="intent" value="address-delete" />
        <input type="hidden" name="id" value={address.id} />
        <p className="typo-body text-on-surface-secondary">
          {t("account.dashboard.deleteAddressConfirm")}
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
