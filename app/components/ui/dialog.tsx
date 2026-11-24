import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { useTranslations } from "~/i18n";
import { cn } from "~/utils/cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
  className?: string;
};

/** Controlled modal with native focus management and Escape handling. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
  className,
}: DialogProps) {
  const common = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      closedby="any"
      onClose={onClose}
      className={cn(
        "ui-overlay ui-dialog m-auto max-h-[min(85dvh,48rem)] w-[min(40rem,calc(100%-2rem))] overflow-hidden rounded-2xl border-0 bg-surface p-0 text-on-surface shadow-2xl",
        className,
      )}
    >
      <div className="flex max-h-[min(85dvh,48rem)] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id={id} className="typo-heading-sm">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={closeLabel ?? common("common.closeDialog")}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
