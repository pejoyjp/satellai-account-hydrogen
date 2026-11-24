# SATELLAI Account Headless

独立的 SATELLAI 账户中心。使用 React Router、Hydrogen 和 Oxygen，保留 Cognito 登录、注册、邮箱验证、密码找回，以及账户内的设备、套餐、兑换码、联系人、订单和地址。商城由现有 Shopify Liquid 主题提供。

## 本地启动

使用 Node.js 22.12+（22.x）或 24.x。

```sh
npm ci
cp .env.example .env
npm run dev
```

开发服务器默认使用 `http://localhost:5173`。访问 `/account` 进入账户流程。不配置凭据时可浏览登录、注册、验证码和找回密码页面。联调认证前，在 `.env` 中设置至少 32 个随机字符的 `SESSION_SECRET`，并按环境填写原 Cognito、CMS 与 Shopify 配置。所有私有配置都由 Worker 读取。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

环境变量、Liquid 导航接入和部署验收见 [账户站接入说明](docs/account-headless.md)。
