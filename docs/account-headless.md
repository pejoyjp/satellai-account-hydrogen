# 账户站与 Liquid 商城接入

## 路由和业务

| 路由                                                     | 行为                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/`                                                      | 跳转到 `/account`                                                                  |
| `/account`                                               | 未登录时进入登录页。登录后展示概览、设备、通信套餐、兑换码、订单、地址和联系人资料 |
| `/account/login`、`/account/register`、`/account/verify` | 沿用原 Cognito 认证代理，支持两步注册、验证码及重发                                |
| `/account/forgot-password`、`/account/reset-password`    | 短期加密 Cookie 保存恢复邮箱，验证码和密码通过 POST 提交                           |
| `/account/addresses`                                     | 兼容旧账户地址入口，转向 `/account?tab=addresses`                                  |
| `/account/logout`                                        | 同源 POST 清除本账户站会话，GET 返回账户入口                                       |

账户站使用精简的导航和共享 UI。注册条款、隐私政策及账户中心 FAQ 分别指向 Liquid 商城的 `/pages/satellai-app-terms-conditions`、`/pages/satellai-app-privacy-policy` 和 `/a/faq`。套餐购买、订阅管理和订单状态继续使用原服务生成的目标地址。旧无头商城的 Shopify Analytics/GTM 集成未迁入账户工程。

原账户后端、数据所有权校验和字段范围沿用源项目。Cognito 负责认证，CMS 和设备 API 提供设备/套餐/兑换码业务。Cognito 的 Multipass 结果经服务端换取单独的 Shopify Storefront 客户令牌，用于订单、地址与联系人。账户站的 HttpOnly Cookie 只属于账户主机，Liquid 店铺和 Shopify 结账继续使用自己的会话。部分订阅管理入口可能要求在对应店铺重新登录。[Shopify Multipass 说明](https://shopify.dev/docs/api/storefront/latest/mutations/customerAccessTokenCreateWithMultipass)

订单列表和详情分别显示 Shopify 的付款状态与履约状态。状态值提供英、德文案，缺失时显示 `—`。列表行按固定网格对齐缩略图、订单号、两个状态、金额和条目按钮，缩略图取首个商品的图片，多于一件时以 `+N` 角标标示，条数按总件数显示。详情弹窗按「元信息 + 明细（图片、规格、数量与单价、小计）+ 金额分解（小计、运费、税费、总计）+ 订单状态入口」排列。

订单使用共享分页与 Shopify 双向游标，每页 10 笔。分页控件只有「上一页 / 页码 / 下一页」，居中排列，不再输出「Showing x–y of z」摘要，也不额外提供首末页箭头。页码由总数（`orders.totalCount`）推导，显示首页、末页与当前页前后各两页，不可达的页码折叠为省略号，因此可见的每个页码都可点击。末页通过 `?page=last` 请求：先用 `last: 10` 取得总数，若总数不是 10 的整数倍，再按余数重新取尾部切片，保证末页与前面的 10 笔分页边界一致。旧版仅含 `after` 游标的链接仍可翻页或返回首页。设备、通信套餐和兑换码使用同一分页组件，每页 8 项，全部页码可直接跳转。

## 环境与部署

- `STOREFRONT_ORIGIN` 是店铺公开 HTTPS origin，默认 `https://satellai.com`。用于页头返回商城、协议和 FAQ 链接。
- `SESSION_SECRET` 至少 32 个随机字符，为当前应用独立生成。Oxygen 上设置 Worker 环境变量。原认证代理地址可通过 `COGNITO_AUTH_API_URL` 指定，`COGNITO_LEGACY_STORE_DOMAIN` 继续传递原店铺的 Multipass 域名。
- `ACCOUNT_CMS_API_KEY` 启用设备、套餐和兑换码业务。`ACCOUNT_CMS_ORIGIN` 使用 CMS 已登记的商城 Origin。可按现有环境配置 API 地址、站点和国家。
- `PUBLIC_STORE_DOMAIN`、`PRIVATE_STOREFRONT_API_TOKEN` 启用账户相关 Shopify 查询和写操作，令牌须包含所用客户读写权限。绑定的 Oxygen 店铺应与 Liquid 商城使用同一 Shopify 后台。缺少 Storefront 配置时 Cognito 账户流程仍可运行，Shopify 资料、订单和地址显示暂不可用。私有客户端使用部署入口提供的买家 IP。
- Oxygen 部署前选择该账户工程对应的环境，运行 `npm run build` 和 `npm run deploy`，再绑定实际的 HTTPS 账户域名。账户域名由部署配置决定。

## Liquid 入口切换

账户服务上线后，将当前主题桌面 `snippets/new_satellai-header-actions.liquid` 和移动 `snippets/new_satellai-header-mobile-panel.liquid` 中账户入口的 `href` 改为实际账户主机的 `/account`。两个入口目前根据 Liquid 的 `customer` 选择 Shopify 登录或账户路由。新的入口统一进入 `/account`，由账户站判断登录状态。移动端的账户入口文案使用 `customer.account_fallback`，避免依据 Liquid 的会话显示账户站登录状态。主题账户设置和现有入口可见条件可继续使用。

上线验收覆盖桌面和移动入口、原商城返回链接、真实账号登录、验证邮件、找回密码、设备及订单读取、受授权的业务写入，以及订阅管理和结账跳转。保留 Shopify 原生订单和 App 生成的链接，按来源评估其他直达旧账户的入口。当前初始化阶段尚未绑定账户域名、部署 Oxygen 或切换线上 Liquid 导航。

## 验证记录

- 2026-11-24：本地 `npm ci`、类型/GraphQL 检查、生产构建及 29 项账户回归通过。回归覆盖 Cognito、MiniOxygen Worker、CMS 所有权及 Shopify Multipass、联系人和地址操作，所有上游写操作均为模拟。
- 已核对线上 SATELLAI App 条款页、隐私政策页和 FAQ 入口。
- 生产构建在 MiniOxygen 中通过请求冒烟，覆盖账户入口和未登录跳转、注册协议链接、无商城路由的 404、账户禁缓存和 CSP、模拟登录、已登录账户页及退出。模拟环境不包含真实 Cognito、CMS 和 Shopify 凭据。
- 验证使用本机独立 Node.js 26。项目沿用依赖声明支持的 Node.js 22.12+（22.x）或 24.x。桌面应用内置 Node.js 24 在本机受 macOS 动态库签名限制，目标版本需在部署环境重新验证。
- 2026-11-24：本地环境配置后，公开和私有 Storefront 令牌均通过同一店铺的只读 GraphQL 查询。账户开发服务启动通过，登录页返回 200，未登录访问账户页返回 302。当前账户站使用私有 Storefront 客户端及 Cognito 会话，公开令牌和 Customer Account OAuth 参数仅保留为本地配置。真实账户登录和客户数据读写仍待验收。
- 2026-11-24：`npm run typecheck`、`npm test`（29 项）及 `npm run build` 通过。使用 MiniOxygen 和无头 Chrome 对生产构建进行模拟冒烟，覆盖订单卡片与详情的两个状态、缺失付款状态、订单页码高亮及双向翻页（1 → 2 → 3 → 2 → 1），以及设备（含概览）、通信套餐和兑换码的分页。真实 Shopify 客户订单的状态与翻页仍待验收。
- 2026-11-24：重做分页与订单列表/详情的信息层级。分页改为居中、仅含上一页/页码/下一页，页码窗口包含首页与末页并用省略号折叠不可达页；订单 loader 支持 `?page=last`，通过 `totalCount` 对齐末页切片。地址卡片把默认地址改为胶囊徽标，编辑/删除为无边框按钮、设为默认为描边按钮并以分隔线区分；订单行改为固定网格列，列表显示商品缩略图与 `+N` 角标，详情弹窗补充商品图、规格、单价与小计/运费/税费分解。`npm run typecheck`、`npm test`（29 项）及 `npm run build` 通过；使用临时预览路由配合无头 Chrome 在 1280/500 两种宽度核对对齐、居中与堆叠表现，预览文件已删除。真实 Shopify 订单的末页跳转与图片加载仍待验收。
