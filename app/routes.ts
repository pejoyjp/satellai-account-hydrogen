import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.ts"),
  route("account", "routes/account/account.tsx"),
  route("account/addresses", "routes/account/addresses.ts"),
  route("account/register", "routes/account/register.tsx"),
  route("account/verify", "routes/account/verify.tsx"),
  route("account/forgot-password", "routes/account/forgot-password.tsx"),
  route("account/reset-password", "routes/account/reset-password.tsx"),
  route("account/login", "routes/account/login.tsx"),
  route("account/logout", "routes/account/logout.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
