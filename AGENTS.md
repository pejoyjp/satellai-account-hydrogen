# SATELLAI Account Headless 工程约定

- 使用中文沟通及维护工程文档。代码、API、命令和 UI 文案沿用各自语境。工程修改完成后同步维护本文和 `docs/`，记录实际验证结果及待办。
- 账户路由在 `app/routes/account/`，UI 在 `app/components/account/`。首页重定向到 `/account`。商城链接使用 `STOREFRONT_ORIGIN` 指向现有 Liquid 店铺。商品、集合、搜索、购物车、结账和内容页属于 Liquid 商城。
- 认证沿用 Cognito 代理。账户会话使用加密 HttpOnly Cookie，生产环境要求 HTTPS。POST 同源校验、账户响应禁缓存和认证代理禁止跟随 3xx 的约束须保留。私有配置和上游请求在服务端处理，严禁将凭据写入代码、文档、日志或浏览器数据。
- 账户业务由 `app/.server/account/` 聚合，认证由 `app/.server/auth/` 提供。Shopify 订单、地址和联系人使用 Multipass 建立独立的 legacy Storefront 客户会话。GraphQL 文档放在 `app/graphql/account/`，仅服务端运行时导入，UI 可导入派生类型。
- 共享 UI 复用 Button、Dialog、Pagination 和 `tokens.css`。文案位于 `app/i18n/{en,de}/`，默认英语。
- 结构或代码修改后运行 `npm run typecheck`、`npm test`、`npm run build`，并对受影响路由运行冒烟检查。模拟验证与真实环境验收分别记录。

## 最近维护

- 2026-11-24：从 `satellai-headless` 初始化独立账户工程，保留账户业务、测试和必要的 Hydrogen/Oxygen 集成，商城协议和 FAQ 链接交回 Liquid。接入与验证见 [账户站接入说明](docs/account-headless.md)。
- 2026-11-24：完成本地 Shopify 与账户会话环境配置。公开及私有 Storefront 只读连接验证通过，凭据仅保存在 Git 忽略的本地环境文件。详见 [账户站接入说明](docs/account-headless.md)。
- 2026-11-24：订单列表与详情显示付款状态及履约状态。订单、设备、通信套餐和兑换码统一使用共享分页并标示当前页。类型及 GraphQL 检查、29 项测试、生产构建和模拟浏览器冒烟通过。真实 Shopify 订单仍待验收。详见 [账户站接入说明](docs/account-headless.md)。
- 2026-11-24：重做分页与列表层级。分页居中，只保留上一页、页码和下一页，页码窗口含首页与末页、不可达页折叠为省略号，订单通过 `?page=last` 直达末页并依据 `totalCount` 对齐切片；订单行改用固定网格列并显示商品缩略图与 `+N` 角标；地址卡片以胶囊徽标、分隔线和主次按钮区分操作；订单详情弹窗补充商品图、规格、单价与金额分解。分页与卡片结构变化后，修改列表项时需保持列宽固定，避免行间错位。详见 [账户站接入说明](docs/account-headless.md)。
