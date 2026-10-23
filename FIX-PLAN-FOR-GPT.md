# 实施交接单 · 给实现方（GPT）

> 角色分工：**本文件作者只做 Review，不改代码。** 你按本单实施，我按每项的「验收标准」逐条核对。
> 因此每一项都必须提供**可机器验证**的验收证据（grep 结果、测试输出、SQL 查询结果、截图），不接受"已修复"的口头结论。

---

## 0. 先读：上一轮 Review 有 5 处需要修正，别照着错的做

| # | 上一轮写法 | 实际事实 | 对你的影响 |
|---|---|---|---|
| 1 | "无 CI" | **有** `.github/workflows/pages.yml`（push main 自动部署） | 准确说法是"有部署 CI，无测试/Lint CI"。别去新建 CI，去补 job。 |
| 2 | "无 Git" | 远端有仓库（97c7db1），但**当前工作副本没有 `.git`** | 交接时要说明改动如何进入仓库（本地改完复制？还是你在有 `.git` 的环境改？）。 |
| 3 | `travel-provider.ts` 是"死代码" | 是**有意预留**的供应商适配边界 | 不要删。改为加注释标注"未接入"，并在文档里避免暗示已具备实时能力。 |
| 4 | Excel 重复导入"必然翻倍" | 同文件重复导入 ID 稳定，走 upsert，**不翻倍** | 真实故障是下一条。 |
| 5 | `.omx/state` 是"产品污染" | 已被 `.gitignore` 忽略 | 优先级下调，属工作区卫生，可在收尾时清理。 |

**第 4 条的真实故障（重要）**：导入订单的 `order_code` 是 `ORD-{行号}`（`app.js:1003`），与手工新增订单的 `nextOrderCode()`（`app.js:150-157`）编码空间重叠，而 schema 有 `unique (user_id, order_code)`（`supabase-schema.sql:45`），upsert 的 `onConflict` 却是 `(user_id,id)`。
→ **账号里已有手工订单时，第一次导入就会因唯一键冲突整体失败。** 这是功能级故障，不是数据洁癖。

---

## 1. 上一轮遗漏、本轮新增的 3 项

### N1【P1】GitHub Pages 把整个仓库根目录发布成公开站点

```yaml
# .github/workflows/pages.yml:31-34
- name: Upload static site
  uses: actions/upload-pages-artifact@v3
  with:
    path: .          # ← 仓库根目录全量上传
```

后果：`supabase/functions/*.ts`、所有 RLS 迁移 SQL、`tests/*.mjs` 全部可被公网下载。数据库结构、权限策略、AI 工具设计等于公开。
**并且**：上一轮生成的 `REVIEW-BRIEF-FOR-GPT.md` 如果已经 push，现在就在线上（`https://<user>.github.io/REVIEW-BRIEF-FOR-GPT.md`）。

### N2【P1】第三处口径分歧：`unknown` 收款状态

- 服务端把 `unknown` 算作应收：`index.ts:360` 的 `['unpaid','partial','unknown']`
- 前端不算：`app.js:177` 只认 `['unpaid','partial']`

叠加已有的两处（`profit_override` 优先级、取消/退款是否排除），同一问题共有 **3 处**规则不一致。

### N3【P2】事件系统（上一轮提出，本单必须一并处理）

6 个 `document.addEventListener('click', ...)`，其中 `app.js:1414-1420` 在**捕获阶段**调用 `stopImmediatePropagation()`，`app.js:77` 同样。新按钮的点击行为取决于监听器注册顺序。
这与 T11（删重复定义）是同一批工作，**合并做，不要分两次**。

---

## 2. 任务清单

排序原则：**先止血（不可逆损失），再口径（让数字可信），再模型（改数据结构），最后工程化。**
每项标注：目标 / 位置 / 做法 / 验收 / 回归风险。

---

### 批次 0 · 30 分钟

#### T0 删除会公开的审查文件 + 收窄发布目录
- 位置：`REVIEW-BRIEF-FOR-GPT.md`、`.github/workflows/pages.yml`
- 做法：
  1. 删除根目录 `REVIEW-BRIEF-FOR-GPT.md`（若已 push，同时确认线上是否已被访问过）。
  2. 新建 `public/`，移入 `index.html`、`app.js`、`styles.css`；`pages.yml` 的 `path` 改为 `public`。
- 验收：
  - `curl -I https://<站点>/REVIEW-BRIEF-FOR-GPT.md` → 404
  - `curl -I https://<站点>/supabase/functions/ai-accounting/index.ts` → 404
  - 站点首页、登录、看板功能正常（截图）
- 回归风险：`index.html` 里三个 CDN + `app.js?v=` 的相对路径不变，移目录不影响；但**确认没有其他文件被 index.html 引用**（如 `favicon`）。

---

### 批次 1 · 安全止血（半天）

#### T1【P0】禁止把服务端 `AI_API_KEY` 发往用户自定义地址
- 位置：`supabase/functions/ai-accounting/index.ts:786-795`、`index.ts:875-877`、`index.ts:805-810`
- 做法：
  1. 新增 `assertAllowedModelHost(raw: string): string`：
     - 必须 `https:`
     - 用 `new URL(x).hostname` 做**精确匹配**白名单，禁止 `includes()`（防 `api.openai.com.evil.com`）
     - 拒绝 IP 字面量与私网/环回/链路本地段（`127/8`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`、`::1`、`fc00::/7`）
     - 白名单来自环境变量 `AI_ALLOWED_HOSTS`，默认 `api.openai.com,api.deepseek.com`
  2. `callModel` 的 `fetch` 加 `redirect: 'error'`，避免白名单地址 302 到别处。
  3. 前端 `app.js:513` 的「接口类型」下拉保持可用，但 `aiBaseUrl` 输入框改为只读（由预设回填），避免用户误以为可以随便填。
- 验收（逐条给证据）：
  | 输入 | 期望 |
  |---|---|
  | `https://api.openai.com/v1` | 正常返回 |
  | `https://api.deepseek.com` | 正常返回 |
  | `https://evil.example.com` | 400，错误信息不泄露内部细节 |
  | `https://api.openai.com.evil.com` | 400（精确匹配生效） |
  | `https://127.0.0.1:8443` | 400 |
  | `http://api.openai.com` | 400（非 https） |
- 回归风险：若有用户当前配置了中转站地址，升级后会被拒绝——**上线前先查一次 `ai_settings` 里 `base_url` 的去重值**，确认是否有非白名单地址，必要时加进 env。

#### T2【P1】订单相关渲染全部转义
- 位置：`app.js:694`（renderQueue）、`722`（renderOrders）、`731`（renderLedger）、`736`（renderOtherIncome）、`966`（openDetails）
- 做法：复用已存在的 `escapeHtml`（`app.js:285`）。**属性值也要转义**（`data-*`、`title`、`style` 里的变量）。
- 验收：
  - 建一笔 `customer = <img src=x onerror=alert(1)>` 的订单 → 表格与详情显示**原文**，无弹窗。
  - `customer = " onmouseover="alert(1)` → 属性未被闭合。
  - 提供一份逐行 grep 结果，列出所有 `innerHTML` 模板里未被 `escapeHtml` 包裹的 `${...}`（应为 0 处）。
- 回归风险：若某些字段历史上曾被允许渲染 HTML（如知识库正文有意保留换行），**知识库不在本次范围内**，别一起改。

#### T3【P1】加 CSP 兜底
- 位置：`index.html` `<head>`
- 做法：至少
  ```
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net https://cdn.sheetjs.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://<项目>.supabase.co wss://<项目>.supabase.co;
  img-src 'self' data:;
  ```
  （`style-src` 必须允许 inline，否则现有 8 段内联样式全废；`connect-src` 必须含 supabase 的 https 与 wss。）
- 验收：页面全功能正常 + Console 无 CSP 报错；T2 的注入用例即使在未转义处也不执行（CSP 拦 inline handler）。
- 回归风险：**这是最容易把线上打挂的一项**——`connect-src` 漏了 wss 会导致 Realtime 静默断连。请贴出 Realtime 仍工作的证据（两侧改一条订单，另一侧自动刷新）。

---

### 批次 2 · 口径统一（1–2 天）

#### T4【P0】一份口径，两端共用
- 问题：`app.js:167-168` 与 `index.ts:296-303` 对 `profit_override` 处理不同；`index.ts:734` 排除取消/退款，`app.js:641` 不排除；N2 的 `unknown` 分歧。
- 做法建议（**需你确认可行性**）：新建 `shared/domain.js`（纯 JS + JSDoc 类型），导出一个对象，包含：
  ```
  isCommissionOrder / orderProfit / customerPaymentStatus / supplierPaymentStatus
  isReceivable / isPayable / isFailedOrder / roomNights / commissionOutstanding
  ```
  - 前端：`<script type="module">` 直接 `import { ... } from './shared/domain.js'`（`app.js` 需改成 module 或用 `window` 挂载过渡）。
  - Deno 端：`import { ... } from '../../shared/domain.js'`（Deno 原生支持相对 JS import）。
  - **不要**把纯逻辑留在两侧各写一遍。
- 验收：同一份 fixture（含：含 `profit_override` 的返佣单、`cancelled` 单、`refunded` 单、`unknown` 收款单、`received<gmv` 的已收款单）下，**前端看板金额 == AI `summarize_business` 金额 == 单元测试期望值**，三者数值贴出来。
- 回归风险：统一后**数字会变**（这正是目的）。上线前给用户一份"口径变更说明"，说明哪一类订单的金额会变、变多少（用旧代码跑一遍同一 fixture 做对比表）。**别让用户以为丢了钱。**

#### T5【P0】时区
- 位置：`app.js:4`、`app.js:1000`、以及全仓 `toISOString().slice(0,10)`
- 做法：本地日期函数（`Asia/Shanghai` 或浏览器本地时区，二选一并说明），`excelDate` 用本地分量拼接，不用 `toISOString()`。
- 验收：
  - 在 UTC+8 环境把系统时间设为 03:00（或用注入时钟的单测）→ `today` 返回当日。
  - 导入含 `2026-10-11` 的 xlsx → 入库 `2026-10-11`（贴 SQL 查询结果）。
- 回归风险：**修复后历史数据会看起来"错了一天"**（因为旧代码把日期往前挪了）。必须回答：是否要写一次性订正脚本？订正依据是什么（原 Excel 文件还在吗？）？

#### T6【P1】运算符优先级 + `unknown` 口径
- 位置：`index.ts:360`
- 做法：加括号，并把 `unknown` 的归属按 T4 的统一规则来。
- 验收：已收款（`received` 与 `gmv` 差 0.01）的订单**不出现**在 AI 待收款列表；贴出修复前后同一查询的返回对比。

#### T7【P1】停止普通操作的全量 upsert
- 位置：`app.js:118-125`（`saveOrdersBatch`）
- 做法：
  - `saveOrdersBatch` **只保留给导入**（本来就需要全量）。
  - 批量修改、字段清洗、AI 确认后的落库改为**按 id 批量 upsert**（只带受影响的行）。
  - 删除保持单条 delete（已是）。
  - 可选加分项：`orders` 增加 `revision` 或复用 `updated_at` 做保存前冲突检测。
- 验收：模拟两端并发——A 删单，B 只改另一单的客户名并保存 → 被删订单**不复活**（贴两端最终 SQL 查询）。
- 回归风险：`qualityActions`、`otherIncomes` 也有类似的全量写，**确认是否一并处理**（我倾向本轮只动 orders，减少变量）。

---

### 批次 3 · 数据模型（3–5 天）

#### T8【P1】独立资金流水表
- 现状：`orders.received` / `supplier_paid` / `commission_received` 是标量，`app.js:1028` 是 `received += value`，历史收款不留痕；「资金流水」页是**反推**出来的（`app.js:646-663`）。
- 做法（**需你确认回填策略**）：
  - 新表 `ledger_transactions(id, user_id, order_id, kind, amount, occurred_at, note, source, created_at)`，`kind ∈ {customer_receipt, supplier_payment, commission_receipt, refund, direct_cost}`，RLS 同 `user_id = auth.uid()` + feature 校验。
  - 写路径：登记收款/付款/返佣时**同时**写流水与更新标量（双写过渡），标量保留为汇总缓存。
  - 历史回填：为每笔现有订单按标量生成一条 `source='backfill'` 的流水，**不要**伪造多笔。
  - 前端「资金流水」页改读新表；金额合计必须与旧实现一致。
- 验收：
  - 一笔订单登记两次收款 → 生成两条流水；流水合计 == 订单 `received`。
  - 回填后，**批次 2 之前的看板/流水合计数值与回填前完全一致**（贴前后对比）。
  - RLS：用户 A 的 token 查不到用户 B 的流水。
- 回归风险：双写期间两边不一致时以谁为准？必须先定规则（我建议以流水为准，标量由触发器或写路径更新）。

#### T9【P1】导入批次 / 预览 / 回滚
- 现状：`app.js:1130` `orders = imported`，整表替换；无批次、无来源行号、无预览、无回滚。规划文档 `.omx/plans/hotel-ops-tool-plan.md:25`、`:190` 明确要求过这些。
- 做法：
  - 新表 `import_batches(id, user_id, file_name, sheet_name, row_count, created_at, status)`；订单增加 `import_batch_id`、`source_row`。
  - 导入改为"预览 → 确认写入"，预览展示：识别行数、将被覆盖的旧批次、异常行（缺日期/缺供应商/成本为 0）。
  - 支持"撤回某个批次"（删除该批次的订单，需二次确认）。
- 验收：同一文件导入两次 → 第二次预览明确提示"与批次 #x 相同，将覆盖"；撤回后订单数回到导入前（贴数量）。

#### T10【P1】修 `order_code` 唯一键冲突
- 位置：`app.js:1003`、`app.js:150-157`、`supabase-schema.sql:45`
- 做法（**需你选一种**）：
  - (a) 导入订单 `order_code` 改用不与手工编码重叠的前缀（如 `IMP-{batch}-{row}`）
  - (b) 导入订单不写 `order_code`，直接以 `id` 展示
  - (c) 把 `unique(user_id, order_code)` 改为部分唯一索引，只约束非导入订单
- 验收：一个已有 10 笔手工订单的账号，导入 432 行文件 → **成功且无唯一键报错**（贴返回值）；手工订单编号不变。

---

### 批次 4 · 工程化（5–8 天）

#### T11 删重复定义（与 N3 事件系统合并做）
- 位置：11 组同名重复声明 + 9 处 `x = function(){}` 覆盖赋值（清单见上一轮 Review 第 5.2.1 节）
- 做法：**只保留真正生效的版本**，删除被覆盖的；`openDetails`/`renderOrders` 的"渲染后再做 DOM 后处理"直接并入函数体；`transactionRows` 只留一个名字。事件改为在每个视图初始化时用 `addEventListener` 绑定到具体容器，去掉捕获阶段 `stopImmediatePropagation`。
- 验收：
  - `grep -c "async function loadAiSettings"` == 1，其余同理（贴 grep 结果）。
  - 关键行为不变：登录 → 看板数字、订单列表分页、详情抽屉、AI 草稿填入、批量修改预览、删除订单，逐项截图。
- 回归风险：**这是最容易被 AI"顺手改坏行为"的一项**。要求：动手前先录一份"关键行为快照"（各页面数字 + 几个典型交互），改完逐项比对，不一致就是回归。

#### T12 ESM 拆分 + 测试 + CSS
- 顺序：先 `shared/domain.js`（T4 已建）→ `data/`（Supabase 访问）→ `ui/`（渲染）→ 最后合并 CSS。
- 测试：`package.json` + `node --test`，先覆盖纯函数（利润、应收、日期范围、失败订单、导入映射），再谈 Playwright。
- 验收：`npm test` 全绿；测试里**不得出现**对源码做正则匹配的断言（现有 `tests/*.mjs` 是反例，不要沿用）。

---

## 3. 硬性约束

1. **不引入 React / Vue / TypeScript 编译 / 打包器。** 原生 ESM 足够。
2. **不重写 UI。** 现有页面结构、CSS 类名尽量不动。
3. **一个 commit 一件事。** 每个任务可独立回滚。
4. **数据库变更必须幂等**（沿用现有迁移风格：`if not exists` / `drop policy if exists`）。
5. **不改变现有 RLS 语义**，除非在交付说明里显式列出并解释。
6. **不要顺手"优化"无关代码**——我 review 时会对着 diff 逐行看，无关改动一律打回。

---

## 4. 需要你先回答的 5 个问题（答完再动手）

1. **`shared/domain.js` 方案是否可行？** Deno 端 `import` 相对 `../../shared/domain.js` 有无障碍（Supabase Edge Function 的部署打包范围是否包含上级目录）？如果不行，替代方案是什么（生成时复制？还是接受两份实现 + 交叉测试）？
2. **资金流水回填策略**：按标量生成 `synthetic` 单条流水 + 双写，你认可吗？还是倾向直接废弃标量？
3. **`order_code` 冲突选 (a)/(b)/(c) 哪个？** 我倾向 (a)，影响面最小。
4. **时区修复后历史数据订正**：做还是不做？依据什么？
5. **`pages.yml` 改 `public/` 后**，README 里"部署到 GitHub Pages 后直接打开网站"的说明是否需要同步更新？

---

## 5. 交付格式（每个任务）

```
T{n} {一句话}
改动文件：path:line
diff 摘要：（贴关键片段，不要整文件）
验收证据：
  - 命令 + 输出（grep / npm test / SQL 查询）
  - 截图（UI 类必附）
回归风险与自测：
  - 我另外验证了：…
待确认：…
```

---

## 6. 我的 Review 会怎么验

1. 先跑你给的验收命令，**不通过直接打回**，不进入人工阅读。
2. 对着 diff 检查是否夹带无关改动。
3. 重点查三类典型回归：
   - CSP 把 Realtime（wss）打断；
   - 转义把本该保留格式的内容（知识库正文、换行）也吃掉了；
   - 统一口径后**没有给用户口径变更说明**，导致用户以为账错了。
4. 每批次结束后更新 `AI-OPERATIONS-CURRENT.md` 的"已完成"列表（含未做项），避免文档与代码再次脱节。

---

## 附：证据索引

```
.github/workflows/pages.yml:31-34   path: . 全仓发布
app.js:77                           捕获阶段 stopImmediatePropagation
app.js:118-125                      saveOrdersBatch 全量 upsert
app.js:150-157                      nextOrderCode 编码空间
app.js:167-168                      前端利润口径
app.js:177                          前端应收状态集合
app.js:285                          escapeHtml
app.js:646-663                      资金流水由订单反推
app.js:694,722,731,736,966          未转义插值
app.js:1000                         excelDate
app.js:1003                         导入 order_code
app.js:1028                         累加式登记收款
app.js:1130                         orders = imported
app.js:1414                         捕获阶段 stopImmediatePropagation
index.ts:296-303                    服务端利润口径
index.ts:360                        应收运算符 + unknown
index.ts:734                        AI 默认排除退款
index.ts:786-795                    safeBaseUrl
index.ts:805-810                    密钥发往用户地址
index.ts:875-877                    读取 ai_settings.base_url
supabase-schema.sql:45              unique(user_id, order_code)
```
