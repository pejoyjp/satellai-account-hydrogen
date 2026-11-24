import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "./resources";
import type {
  Catalog,
  Catalogs,
  Locale,
  Namespace,
  TranslationKey,
} from "./types";
export { DEFAULT_LOCALE } from "./resources";
export type { Locale, Namespace, TranslationKey } from "./types";

type State = { locale: Locale; catalogs: Partial<Catalogs> };
const Context = createContext<State>({ locale: DEFAULT_LOCALE, catalogs: {} });
export function I18nProvider({
  locale = DEFAULT_LOCALE,
  common,
  children,
}: {
  locale?: Locale;
  common?: Catalog<"common">;
  children: ReactNode;
}) {
  const state = useMemo(
    () => ({ locale, catalogs: { common } }),
    [locale, common],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function TranslationProvider<N extends Namespace>({
  namespace,
  catalog,
  children,
}: {
  namespace: N;
  catalog: Catalog<N>;
  children: ReactNode;
}) {
  const parent = useContext(Context);
  const state = useMemo(
    () => ({
      ...parent,
      catalogs: { ...parent.catalogs, [namespace]: catalog },
    }),
    [parent, namespace, catalog],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useLocale(): Locale {
  return useContext(Context).locale;
}
export function useTranslations<N extends Namespace>(namespace: N) {
  const catalog = useContext(Context).catalogs[namespace];
  /** `{name}` placeholders are replaced by the supplied values. */
  return (
    key: TranslationKey<N>,
    values?: Record<string, string | number>,
  ): string => {
    if (!catalog)
      throw new Error(`Translation namespace "${namespace}" was not loaded`);
    const template = (catalog as Record<string, string>)[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder,
    );
  };
}
