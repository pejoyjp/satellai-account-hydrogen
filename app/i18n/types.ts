import type account from "./en/account";
import type common from "./en/common";

export type Locale = "en" | "de";
type StringValues<T> = { [K in keyof T]: string };
export type Catalogs = {
  account: StringValues<typeof account>;
  common: StringValues<typeof common>;
};
export type Namespace = keyof Catalogs;
export type Catalog<N extends Namespace> = Catalogs[N];
export type TranslationKey<N extends Namespace> = keyof Catalogs[N] & string;
