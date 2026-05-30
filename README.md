# AI PR Reviewer

**AI PR Reviewer** 是一个面向 GitHub Pull Request 的 AI 代码评审工具。它可以读取 PR 元数据和 changed files，构建 Review Context，结合静态分析信号和 AI/Mock 模型生成结构化 Review 报告，并提供可解释依据与可复制的 GitHub Review Comment 草稿。

## Live Demo

[立即体验 GitHub Pages Demo](https://cc-c122.github.io/AI-PR-Reviewer/)

GitHub Pages Demo 是静态演示模式：

- 不需要后端
- 不需要 GitHub Token
- 不需要 OpenAI Key
- 不会真实调用 GitHub API、后端 API 或 AI 模型
- 使用浏览器内置 mock 数据展示完整评审流程

这个 Demo 适合快速查看产品交互、报告结构、分析依据和评论草稿复制能力。真实 GitHub PR 获取、SQLite 持久化和真实 AI provider 调用需要在本地完整模式或服务端部署模式下运行。

示例 PR 可直接复制使用：

```text
https://github.com/cc-c122/AI-PR-Reviewer/pull/1
```

这个 PR 会长期保持 open，里面包含少量故意设计的 Review 问题，适合在本地完整模式中作为真实 GitHub PR 输入样本。

## 完整体验

### 本地完整模式

macOS / Linux：

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm dev
```

Windows PowerShell：

```powershell
pnpm install
Copy-Item .env.example .env
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm dev
```

默认地址：

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health Check: `http://localhost:4000/api/health`

### 环境变量

复制 `.env.example` 为 `.env` 后按需配置：

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 可选 | 公开 PR 不配置也可尝试获取；配置后 GitHub API rate limit 更高。 |
| `OPENAI_API_KEY` | 可选 | 配置后启用真实 OpenAI-compatible provider；不配置时使用 `MockReviewModelClient`。 |
| `OPENAI_MODEL` | 可选 | 模型名称，默认 `gpt-4o-mini`。 |
| `OPENAI_BASE_URL` | 可选 | OpenAI-compatible API 地址，默认 `https://api.openai.com/v1`。 |
| `DATABASE_URL` | 可选 | SQLite 地址，默认可使用 `file:./dev.db`。 |
| `API_PORT` | 可选 | API 端口，默认 `4000`。 |
| `WEB_PORT` | 可选 | Vite Web 端口，默认 `5173`。 |
| `NODE_ENV` | 可选 | 设为 `production` 时，Fastify 可提供前端构建产物。 |

项目不会把 GitHub Token、OpenAI Key、完整请求 headers 或完整源码内容写入数据库/API 响应。

## 当前功能清单

- **PR URL 解析**：支持 `https://github.com/{owner}/{repo}/pull/{number}`。
- **GitHub PR 获取**：通过 Octokit 获取公开 PR 元数据、changed files 和 patch。
- **Context Builder**：构建包含 PR 信息、patch、受限文件内容、测试候选路径和 contextSources 的 Review Context。
- **Static Analysis**：扫描 generated/lock/build 文件、大变更、缺少测试、可疑安全模式和可维护性模式。
- **AI Review / Mock fallback**：有 `OPENAI_API_KEY` 时使用 OpenAI-compatible provider；没有 key 时使用 mock，方便本地和 Demo 稳定运行。
- **结构化报告**：展示 PR 基本信息、summary、riskLevel 和 findings。
- **可解释报告**：展示上下文来源统计、文件上下文摘要、静态分析 signals、skippedFiles 和 riskHints。
- **Review Comment 草稿**：为每条 finding 生成 Markdown，可复制单条评论、所有 blocking 评论或完整 review summary。
- **本地持久化**：使用 Prisma + SQLite 保存 AnalysisTask、PullRequestSnapshot、AnalysisReport 和 AnalysisDetails。
- **GitHub Pages 静态 Demo**：无需后端和密钥即可体验完整前端流程。

## 为什么不直接把代码粘贴给大模型？

直接将代码或 diff 粘贴给通用大模型，确实可以快速获得一些 Review 建议。对于一次性、小规模代码检查，这种方式简单且有效。

但在真实 Pull Request 评审场景中，直接询问通用大模型仍然存在一些明显问题：

| 对比维度 | 直接询问通用大模型 | AI PR Reviewer |
| --- | --- | --- |
| 输入方式 | 手动复制代码或 diff | 输入 GitHub PR 链接，自动获取变更 |
| 上下文获取 | 依赖用户手动补充，容易遗漏 | 自动获取 PR 描述、变更文件、patch、文件上下文等信息 |
| 分析范围 | 容易一次性塞入过多无关代码 | 优先聚焦新增和修改代码，减少噪声 |
| 输出格式 | 通常是自由文本，难以快速定位 | 输出结构化 finding，包含文件路径、风险等级、证据和建议 |
| 误报控制 | 模型可能对旧代码或弱证据过度推断 | 结合静态规则、置信度和人工确认标记降低误报 |
| 稳定性 | 每次提问方式不同，输出质量波动较大 | 使用统一 prompt、schema 结构约束和分析流程 |
| 可复用性 | 更适合临时问答 | 更适合重复使用和团队协作 |
| 扩展能力 | 很难接入工程流程 | 可扩展到 GitHub App、GitLab、CI/CD 和企业私有仓库 |

### 本项目的核心价值

AI PR Reviewer 并不是简单地“调用一次大模型”，而是将代码评审过程拆分为多个工程化步骤：

```text
输入 GitHub PR 链接
        ↓
自动获取 PR 元数据与代码变更
        ↓
解析 diff，识别新增和修改代码
        ↓
构造 Review Context（评审上下文）
        ↓
静态规则检测 + AI 分析
        ↓
结构化输出风险项、证据、置信度和修改建议
```

项目重点解决以下问题：

1. **减少人工整理上下文的成本**：用户不需要手动复制代码、描述变更或补充文件信息。
2. **减少无关代码噪声**：系统优先分析 PR 中新增和修改的代码，而不是让模型扫描整个仓库。
3. **提升输出可执行性**：每个问题尽量关联具体文件、代码位置、风险等级和修改建议。
4. **降低模型幻觉和误报**：对证据不足的问题降低 confidence，并标记为需要人工确认，而不是直接下结论。
5. **为后续工程化扩展提供基础**：后续可以接入自动评论、团队规则、自定义代码规范、CI/CD 流程和企业私有仓库。

### 适用边界

本项目定位为 AI-assisted Review 工具，而不是人工 Review 的替代品。

它适合帮助开发者快速发现高风险代码、遗漏测试和潜在问题，但最终判断仍然需要开发者结合业务语义和项目背景完成。

## 技术架构

技术栈：

- React
- Vite
- TypeScript
- Fastify
- Prisma
- SQLite
- Octokit
- Zod
- OpenAI-compatible provider
- Vitest

工作流：

```mermaid
flowchart LR
  A["用户输入 PR URL"] --> B["Fastify API 解析 PR URL"]
  B --> C["Octokit 获取 PR metadata / changed files / patch"]
  C --> D["Context Builder 构建 Review Context"]
  D --> E["Static Analysis 生成规则信号"]
  E --> F["AI Provider 或 Mock 生成结构化报告"]
  F --> G["Prisma + SQLite 持久化任务、报告和分析详情"]
  G --> H["前端展示报告、分析依据和评论草稿复制"]
```

Monorepo 模块：

- `apps/web`：React 前端，负责 PR 输入、报告展示、分析依据展示和复制 Review Comment。
- `apps/api`：Fastify API，负责任务创建、报告生成、静态文件服务和持久化协调。
- `packages/core`：纯类型、PR 解析、风险评估、Context Builder、报告生成接口。
- `packages/github`：GitHub API 集成，获取 PR snapshot 和受限文件内容。
- `packages/model`：MockReviewModelClient 和 OpenAI-compatible provider。
- `packages/static-analysis`：基于 Review Context 的规则扫描和风险提示。
- `prisma`：SQLite schema 和迁移。

## 模型选择

系统采用 OpenAI-compatible provider + Mock fallback 的双模式设计：

- **无密钥场景**：未配置 `OPENAI_API_KEY` 时使用 `MockReviewModelClient`，保证本地和 GitHub Pages Demo 不依赖外部模型。
- **真实分析场景**：配置 `OPENAI_API_KEY` 后切换到 OpenAI-compatible provider，模型输出必须通过 Zod schema 校验。
- **安全边界**：Prompt 要求模型只基于提供的 Review Context 和 Static Analysis 分析，不得臆造；schema 校验失败会返回清晰错误。

当前版本不会自动写回 GitHub Review Comment，也不是 GitHub App。复制按钮生成的是评论草稿，由 Review 人员自行粘贴到 GitHub。

## 上下文获取方式

本地完整模式会通过 GitHub API 获取：

- PR title / description / author / baseRef / headRef / commitSha
- changed files metadata
- changed file patch
- PR head commit 下的文件内容，带单文件大小限制和最大文件数限制
- 测试文件候选路径

系统会保留可展示的上下文摘要：

- 文件路径
- contextSources
- contentAvailable
- contentTruncated
- isTestFile
- testCandidatePaths

不会在 analysis details、数据库或 API 响应里暴露完整源码内容。

## 验收状态

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| PR URL 解析 | 已实现 | 支持 GitHub PR URL 校验与解析。 |
| GitHub changed files 获取 | 已实现 | 获取 PR 元数据、changed files 和 patch。 |
| Review Context | 已实现 | 包含 patch、受限文件内容、测试候选路径和 contextSources。 |
| Static Analysis | 已实现 | 覆盖跳过 generated/lock/build、大变更、缺少测试、安全和可维护性信号。 |
| Report Details | 已实现 | 持久化并返回 reviewContextSummary、staticAnalysis 和 generatedAt。 |
| Copy Review Comment | 已实现 | 支持复制单条 finding、所有 blocking findings、完整 review summary。 |
| GitHub Pages Demo | 已实现 | 静态 mock Demo，不调用真实后端/GitHub/AI。 |

验证命令：

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## 部署

GitHub Pages Demo 由 `.github/workflows/pages.yml` 在 `master` 分支 push 后自动构建，构建时设置：

```bash
GITHUB_PAGES=true
VITE_DEMO_MODE=true
```

当前公开入口为 GitHub Pages 静态 Demo。完整服务端版本可按上面的本地完整模式运行，或参考 [docs/deployment.md](docs/deployment.md) 自行部署可选 Render 服务；仓库当前不提供公开后端服务地址。

## 未来扩展方向

以下能力是后续方向，不属于当前 MVP 已实现范围：

- GitHub App 集成和自动触发分析
- 自动写回 GitHub Review Comment 或 Check Run
- CI 状态、测试结果和历史 Review 评论分析
- 团队级规则配置、质量基线和误报反馈闭环
- 更深入的语义上下文检索，例如调用方/被调用方、函数级上下文和架构文档
- 多模型策略、成本控制和异步队列
