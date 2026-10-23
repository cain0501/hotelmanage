# 奢隐旅业助手：酒店与机票运营工作台

这是一个静态前端酒店与机票运营工作台，使用 Supabase Auth、Postgres、RLS 和 Realtime 保存云端数据。包含：

- 酒店/机票订单拆分
- 房晚、票数、GMV、成本、利润和客户待收款实时统计
- 客户收款、供应商 / 平台付款、平台返佣三套状态独立记录
- 新增订单、编辑订单、登记收款、付款平台和开票信息
- 订单详情、收款/实际成本付款流水和收款登记
- 数据待办：待收款、零成本、资料缺失
- Excel 订单导入
- 电脑与手机共享同一份云端数据
- AI 工作台会话、上下文和专业酒店知识库

## 使用方式

## Supabase 初始化

1. 打开 Supabase Dashboard，进入项目的 `SQL Editor`。
2. 打开本项目的 `supabase-schema.sql`，完整复制并点击 `Run`。
3. 在 Supabase 的 Authentication 中创建一个邮箱账号，或打开网站后使用注册功能。
4. 打开网站登录。云端没有数据时，页面会询问是否上传当前浏览器中的本地数据。

## 多用户账户与权限

执行基础 `supabase-schema.sql` 后，还需要执行最新的 `supabase/migrations/20261021120000_multi_user_access_control.sql`。该迁移会把 `zzljb520@hotmail.com` 初始化为管理员；其它新注册用户默认为“待审核”，管理员通过“用户管理”页面审核并分配功能。

订单、其它收入、AI 对话、AI 记忆、模型配置和待确认任务按登录用户隔离。专业知识库采用“用户草稿私有、管理员发布后全员可读”的规则。管理员权限管理不等于默认拥有所有用户的业务数据查看权。

网站内使用的是 Supabase Publishable key，只能配合 RLS 访问当前登录用户的数据，不要把 `service_role` key 或数据库密码放到前端。

## 使用方式

部署到 GitHub Pages 后直接打开网站并登录即可。仓库只把 `public/` 发布为网站内容；本地请在 `public/` 目录启动静态服务器，直接双击 `public/index.html` 可能受浏览器跨域策略影响。

登录后，新增、编辑、收款登记、其它收入和 Excel 导入都会写入 Supabase。侧边栏的“上传本地数据”可把当前浏览器旧账本迁移到云端，同编号记录会更新，不同编号记录会保留。

## AI 一句话记账

1. 在 Supabase SQL Editor 执行最新的 `supabase-schema.sql`，会一并创建 AI 设置、会话、上下文、待确认任务和专业知识库表。
2. 部署 `supabase/functions/ai-accounting` Edge Function。
3. 在 Supabase Edge Function Secrets 中设置 `AI_API_KEY`，不要把 API Key 写进前端或 GitHub。
4. 网站登录后打开“AI 工作台”，填写接口地址、模型名称并启用。
5. 输入自然语言，AI 会区分经营查询、记账请求和一般/专业知识问题；涉及保存时仍先生成草稿。
6. 在“专业知识库”中先保存酒店规则草稿，点击“发布使用”后 AI 才会检索该知识。
7. 在 Supabase SQL Editor 执行 `supabase/assistant-memory-migration.sql`，启用 AI 记忆表；“AI 记忆”页面中的内容只有手动保存或对话确认后才会生效。

默认按 OpenAI 兼容接口调用，DeepSeek 可填写 `https://api.deepseek.com`。模型配置只保存接口地址、模型名和开关，密钥由 Edge Function Secret 管理。
