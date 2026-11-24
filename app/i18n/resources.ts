import type { Catalog, Locale, Namespace } from "./types";
export const DEFAULT_LOCALE: Locale = "en";

const loaders = {
  en: {
    account: () => import("./en/account"),
    common: () => import("./en/common"),
  },
  de: {
    account: () => import("./de/account"),
    common: () => import("./de/common"),
  },
};
export async function loadTranslations<N extends Namespace>(
  locale: Locale,
  namespace: N,
): Promise<Catalog<N>> {
  const module = await loaders[locale][namespace]();
  return module.default as Catalog<N>;
}
