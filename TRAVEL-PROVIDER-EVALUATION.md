# 奢隐旅业助手 · 旅行供应商接入评估

更新时间：2026-10-23

## 结论

当前不接入真实供应商账号，不开启实时搜索、锁价、预订或支付。现有 `TravelProvider` 接口已经保留，后续只需要增加服务端适配器。

## 本地试用包核对结果

用户提供的目录 `dida-mcp_trial-package-CH (1)` 内实际包含的是：

- `dida-hotel-booking-cn/SKILL.md`
- `references/cli-params.md`
- `scripts/rgh.js`
- `scripts/rgh.py`

文件内容显示该包的实际产品是 RollingGo 酒店 CLI，命令为 `rgh`，仓库标识为 `RollingGo-AI/rollinggo-hotel-skill-CN`，并不是可直接嵌入当前网站的 Dida MCP 服务端代码。

## 能力映射

| 供应商能力 | 内部接口 | 当前状态 |
|---|---|---|
| `search-hotels` | `searchHotels` | 可适配，未接入 |
| `hotel-detail` | `getHotelDetail` / `checkAvailability` | 可适配，未接入 |
| `price-confirm` | `confirmPrice` | 可适配，未接入 |
| `book` | `createBooking` | 高风险，必须二次确认 |
| `orders` | `listOrders` | 可适配，未接入 |
| `order-detail` | `getOrderDetail` | 可适配，未接入 |

## 暂不接入的原因

1. 当前试用包是 RollingGo CLI，不是 Dida MCP 服务端实现，不能直接当作道旅接口部署。
2. 登录授权需要执行本地 CLI 流程，不能放进 GitHub Pages 浏览器端。
3. 实时价格只能作为参考价，必须经过价格确认后才能进入预订流程。
4. 预订、支付链接和取消属于真实消费操作，必须保留人工确认和服务端审计。
5. 供应商订单号、参考号和支付状态不能直接写成本地订单编号、GMV 或收款状态。

## 后续接入条件

- 提供真正的 Dida MCP 服务端或官方接口文档、测试凭据和调用方式。
- 在 Supabase Edge Function 或独立服务端保存供应商凭据。
- 先实现只读搜索和房型查询，再实现价格确认，最后评估预订。
- 通过测试账号验证超时、价格变化、取消政策和重复请求。
- 预订成功后只写入本地订单草稿，人工确认后才转为正式订单。

当前决策：保留接口，暂不接入真实供应商。
