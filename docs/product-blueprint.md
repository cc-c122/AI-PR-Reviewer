# Product Blueprint

> 本文档是项目的长期产品蓝图。  
> 当前三天 MVP 已完成的能力以 README 为准；未实现能力均列为后续扩展方向。

## 产品定位

AI PR Reviewer 是面向 GitHub Pull Request 的 AI-assisted Review 工具。它的目标不是替代人工 Review，而是帮助 Review 人员更快理解 PR 变更、识别高风险区域、查看可解释证据，并生成可复制的 Review Comment 草稿。

当前项目以“输入公开 PR URL -> 获取 PR 上下文 -> 生成结构化报告 -> 展示可解释依据 -> 复制评论草稿”为主线。更复杂的团队协作、自动化回写和企业化能力属于长期规划。

## 当前 MVP 已落地能力

当前 MVP 已实现并可在本地完整模式中运行的能力包括：

1. 解析 GitHub Pull Request URL。
2. 通过 GitHub API 获取公开 PR 元数据、changed files 和 patch。
3. 构建 Review Context，包含 PR 基本信息、patch、受限文件内容、测试候选路径和上下文来源说明。
4. 运行轻量静态分析规则，识别 generated/lock/build 文件、大变更、缺少测试变更、可疑安全模式和可维护性信号。
5. 区分 `introduced_by_pr` 与 `context_only` 静态分析信号，并对需要人工确认的上下文信号降噪。
6. 使用 OpenAI-compatible provider 生成结构化 Review 报告；未配置 `OPENAI_API_KEY` 时 fallback 到 `MockReviewModelClient`。
7. 使用 Zod schema 校验模型输出，确保 findings 结构稳定。
8. 使用 Prisma + SQLite 本地持久化任务、PR snapshot、报告和可解释 details。
9. 在 Web 页面展示 PR 信息、summary、riskLevel、findings、分析依据、静态分析信号、跳过文件和文件上下文摘要。
10. 为 findings 生成可复制的 GitHub Review Comment Markdown 草稿。
11. 提供 GitHub Pages 静态 Demo，使用浏览器内置 mock 数据展示完整前端流程，不调用真实 GitHub API、后端服务或 AI 模型。

## 当前 MVP 不包含的能力

以下能力尚未在当前 MVP 中实现，不应理解为当前可用功能：

1. 多模型路由，或 fast model / reasoning model 的自动分层调度。
2. tree-sitter 深度语义分析、函数级调用链分析或跨文件语义图谱。
3. pgvector / 向量检索 / 历史代码语义检索。
4. Redis、BullMQ 或生产级异步任务队列。
5. 自动回写 GitHub Review Comment、Check Run 或 GitHub App 自动触发。
6. CI 状态、测试结果和历史 Review 评论聚合。
7. 关联 issue、ticket、需求文档或事故复盘。
8. 私有仓库权限体系、组织级用户系统或团队规则中心。
9. 多阶段企业化部署、计费、审计和权限管理。

## 长期产品方向

长期目标是让 AI PR Reviewer 从单次 PR 报告工具逐步演进为团队级 Review Copilot。后续可以围绕以下方向扩展。

### 上下文增强

未来可在当前 Review Context 基础上增加更深层的代码理解能力：

1. 使用 tree-sitter 或语言服务提取函数、类、调用关系和类型定义。
2. 获取被调用方、调用方、配置文件、数据库 schema 和相关测试上下文。
3. 引入历史 PR、issue、事故复盘和团队规范作为可检索上下文。
4. 使用 pgvector 或其他向量检索方案检索相似变更和历史 Review 经验。

这些能力目前属于长期规划，当前 MVP 只实现了 patch、受限文件内容、测试候选和 contextSources。

### 模型策略

当前实现使用单一 OpenAI-compatible provider，并在无 API Key 时使用 Mock fallback。未来可以根据风险级别引入分层模型策略：

1. 使用速度更快、成本更低的模型生成 PR 摘要。
2. 对高风险文件调用推理能力更强的模型。
3. 对关键 finding 增加二次验证，进一步降低误报。
4. 根据文件类型、风险类型和上下文大小动态选择 prompt 与模型。

多模型路由尚未实现，详细现状见 [Model Strategy](model-strategy.md)。

### 静态分析与误报控制

当前静态分析层是轻量规则扫描，主要用于给模型提供可解释信号。未来可以扩展为更强的分析层：

1. 增加语言感知规则和框架特定规则。
2. 将新增行、上下文命中、测试变更和历史信号进行更细粒度合并。
3. 支持团队自定义规则、忽略规则和误报反馈。
4. 引入二次验证流程，避免低置信度规则命中被误当成确定 bug。

### Review 工作流集成

当前 MVP 只生成可复制的评论草稿，不会自动写回 GitHub。未来可以扩展：

1. GitHub App 自动监听 PR 创建和更新事件。
2. 将高置信度 finding 写入 GitHub Review Comment 或 Check Run。
3. 聚合 CI 状态、测试失败信息和代码覆盖率变化。
4. 支持 Review 人员标记误报、接受建议或生成后续任务。

自动回写评论、GitHub App 和 CI 状态聚合目前均未实现。

### 存储与任务系统

当前 MVP 使用 Prisma + SQLite 做本地持久化，并在请求链路中同步生成报告。未来可扩展：

1. PostgreSQL 作为生产数据库。
2. Redis + BullMQ 或其他队列系统处理长任务。
3. 对大型 PR 进行异步分片分析、重试和进度追踪。
4. 对历史分析结果做缓存和质量统计。

Redis、BullMQ 和生产级任务队列目前均未实现。

### 团队与企业化能力

未来团队版可以考虑：

1. 私有仓库授权、组织成员权限和审计日志。
2. 团队级 Review 规则、风险阈值和质量基线。
3. 关联 issue / ticket / 需求文档，帮助模型理解业务背景。
4. Review 质量指标看板，例如误报率、采纳率、平均 Review 时间和高风险模块分布。

这些能力属于长期规划，不属于当前 MVP。

## 设计原则

1. 证据优先：每条 finding 应尽量关联文件、行号、patch、静态分析信号或上下文来源。
2. 人在回路：AI 输出是辅助判断，不代表最终 Review 结论。
3. 降低噪声：context-only 信号必须明确标注为需要人工确认，避免把旧代码问题当成本 PR 新增风险。
4. 结构化输出：报告应便于前端展示、复制评论、缓存和后续扩展。
5. 安全边界清晰：不要在数据库、日志或 API 响应中暴露 GitHub Token、OpenAI Key、请求 headers 或完整源码内容。

## 与 README 的关系

README 是当前仓库的主入口，描述已完成能力、快速体验方式、本地运行步骤和验收状态。本文档只描述长期产品方向和扩展蓝图；当本文档与 README 对当前能力的描述不一致时，以 README 为准。
