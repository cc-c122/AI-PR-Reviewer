# AI PR Reviewer

**AI PR Reviewer** 是一个面向 GitHub Pull Request 的 AI 代码评审工具。它可以读取 PR 元数据和 changed files，构建 Review Context，结合静态分析信号和 AI/Mock 模型生成结构化 Review 报告，并提供可解释依据与可复制的 GitHub Review Comment 草稿。

## Live Demo

[立即体验 GitHub Pages Demo](https://cc-c122.github.io/AI-PR-Reviewer/)

GitHub Pages Demo 是静态演示模式：

- 不需要后端
- 不需要银行卡
- 不需要 GitHub Token
- 不需要 OpenAI Key
- 不会真实调用 GitHub API、后端 API 或 AI 模型
- 使用浏览器内置 mock 数据展示完整评审流程

这个 Demo 适合快速查看产品交互、报告结构、分析依据和评论草稿复制能力。真实 GitHub PR 获取、SQLite 持久化和真实 AI provider 调用需要在本地完整模式或服务端部署模式下运行。

## 快速体验

### 在线 Demo

打开 [https://cc-c122.github.io/AI-PR-Reviewer/](https://cc-c122.github.io/AI-PR-Reviewer/)，输入任意形如 `https://github.com/org/repo/pull/123` 的 PR URL，即可看到静态 mock 报告。

示例 PR：[demo: intentionally flawed review example](https://github.com/cc-c122/AI-PR-Reviewer/pull/1)。这个 PR 会长期保持 open，里面包含少量故意设计的 Review 问题，适合在本地完整模式中作为真实 GitHub PR 输入样本。

### 本地完整模式

```bash
pnpm install
cp .env.example .env
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

Render 单服务部署说明见 [docs/deployment.md](docs/deployment.md)。服务端部署后同一个服务会同时提供 Web 页面和 `/api/*` 接口；未配置 `OPENAI_API_KEY` 时会使用 mock 模型。

## 未来扩展方向

以下能力是后续方向，不属于当前 MVP 已实现范围：

- GitHub App 集成和自动触发分析
- 自动写回 GitHub Review Comment 或 Check Run
- CI 状态、测试结果和历史 Review 评论分析
- 团队级规则配置、质量基线和误报反馈闭环
- 更深入的语义上下文检索，例如调用方/被调用方、函数级上下文和架构文档
- 多模型策略、成本控制和异步队列
