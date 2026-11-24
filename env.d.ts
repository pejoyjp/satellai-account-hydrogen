/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />

import type { Env as AppEnv } from "./app/lib/env";

declare module "react-router" {
  interface RouterContextProvider {
    waitUntil: ExecutionContext["waitUntil"];
  }
}

declare global {
  interface Env extends AppEnv {}
}
