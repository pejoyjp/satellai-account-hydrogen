import { createContext } from "react-router";

export type Env = {
  STOREFRONT_ORIGIN?: string;
  SESSION_SECRET?: string;
  COGNITO_AUTH_API_URL?: string;
  COGNITO_LEGACY_STORE_DOMAIN?: string;
  ACCOUNT_CMS_API_URL?: string;
  ACCOUNT_CMS_ORIGIN?: string;
  ACCOUNT_CMS_API_KEY?: string;
  ACCOUNT_DEVICE_API_URL?: string;
  ACCOUNT_SITE_KEY?: string;
  ACCOUNT_COUNTRY?: string;
  PRIVATE_STOREFRONT_API_TOKEN?: string;
  PUBLIC_STORE_DOMAIN?: string;
  PUBLIC_CHECKOUT_DOMAIN?: string;
};

export const envContext = createContext<Env>();
