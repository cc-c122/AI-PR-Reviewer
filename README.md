# AI PR Reviewer

**AI PR Reviewer** 是一个面向 GitHub Pull Request 的 AI 代码评审工具。它可以读取 PR 变更，生成 PR 总结、风险等级和结构化 Review findings，帮助开发者更快理解改动、定位高风险代码，并形成可执行的评审建议。

## Live Demo

[立即体验 GitHub Pages Demo](https://cc-c122.github.io/AI-PR-Reviewer/)

GitHub Pages Demo 是**静态演示模式**：

- 不需要后端
- 不需要银行卡
- 不需要 GitHub Token
- 不需要 OpenAI Key
- 使用浏览器内置 mock 数据展示完整评审流程

这个 Demo 适合快速查看产品交互、报告结构和 Review 工作流。完整的 GitHub PR 获取、数据库持久化和真实模型调用需要在本地完整模式或服务端部署模式下运行。

## 功能特性

- **PR 变更总结**：概括 PR 目的、变更规模、关键文件和基础风险。
- **风险代码识别**：根据 changed files、diff 信号和路径特征识别潜在风险。
- **Review 建议生成**：输出结构化 findings，包括证据、建议和是否阻塞合并。
- **严重级别和置信度**：支持 `critical`、`major`、`minor`、`info` 以及 confidence 标注。
- **本地持久化**：使用 Prisma + SQLite 保存分析任务、PR Snapshot 和报告。
- **GitHub Pages 静态 Demo**：无需任何密钥即可体验完整页面流程。

## 本地完整模式

本地完整模式支持真实分析公开 GitHub PR：

- 输入公开 GitHub PR URL
- 后端通过 Octokit 获取 PR 元数据和 changed files
- 生成 PR 总结、风险等级和 Review findings
- Prisma + SQLite 持久化任务和报告
- 配置 `OPENAI_API_KEY` 时使用真实 OpenAI-compatible provider
- 没有 key 时自动使用 `MockReviewModelClient`

## 技术栈

- React
- Vite
- TypeScript
- Fastify
- Prisma
- SQLite
- Octokit
- Zod
- OpenAI-compatible provider

## 架构流程

```mermaid
flowchart LR
  A["用户输入 PR URL"] --> B["API 获取 GitHub PR"]
  B --> C["生成 PullRequestSnapshot"]
  C --> D["风险分析"]
  D --> E["模型或 Mock 生成报告"]
  E --> F["前端展示 Summary / Risk / Findings"]
```

## 设计思路

### 模型选择

系统采用 OpenAI-compatible provider + Mock fallback 的双模式设计：

- **本地和演示场景**：未配置 `OPENAI_API_KEY` 时使用 `MockReviewModelClient`，保证项目无需密钥也能稳定展示完整 Review 流程。
- **真实分析场景**：配置 `OPENAI_API_KEY` 后切换到 OpenAI-compatible provider，模型输出必须通过 Zod schema 校验，避免不可解析或字段缺失的结果进入报告。
- **后续多模型策略**：轻量模型用于 PR 总结和文件级摘要，强推理模型用于高风险文件、安全相关代码和复杂业务逻辑，兼顾速度、成本和准确性。

### 上下文获取方式

当前本地完整模式会通过 GitHub API 获取 PR 元数据、changed files 和 patch，并生成 `PullRequestSnapshot` 作为分析输入。风险分析会结合文件路径、变更规模、测试文件信号和 patch 中的可疑标记生成初步风险等级。

为了控制误报和漏报，系统设计上不会只依赖模型自由输出，而是采用：

- PR metadata + changed files + patch 作为基础证据
- 结构化 risk assessment 作为模型输入
- schema 校验保证 findings 包含 severity、category、evidence、suggestion、confidence、blocking
- Mock/模型输出都必须引用具体文件或变更证据

后续会继续增强上下文构建能力，包括获取完整文件内容、相关测试文件、调用方/被调用方、配置文件、CI 状态、已有评论和关联 issue，并对大 PR 做上下文预算控制。

### 未来扩展方向

- **上下文增强**：构建 Review Context，补充完整文件内容、测试候选、函数级上下文和依赖关系。
- **静态分析结合 AI**：引入 tree-sitter 和规则扫描，与模型 findings 交叉验证，降低误报。
- **分阶段分析**：先返回 PR 总结和高风险文件，再异步生成深度 Review 建议，提高响应速度。
- **GitHub App 集成**：支持 PR 创建或更新时自动触发分析，并回写 Check Run 或 Review Comment。
- **团队规则配置**：支持组织级安全基线、代码规范、目录风险权重和自定义提示词。
- **反馈闭环**：支持用户标记有用、误报、已处理，用于后续优化规则和模型提示。

## 本地运行

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

## 验证命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需配置：

| 变量 | 说明 |
| --- | --- |
| `GITHUB_TOKEN` | 可选。公开 PR 不配置也可使用；配置后 GitHub API rate limit 更高。 |
| `OPENAI_API_KEY` | 可选。配置后启用真实 OpenAI-compatible provider；不配置时使用 mock。 |
| `OPENAI_MODEL` | 可选。模型名，默认 `gpt-4o-mini`。 |
| `OPENAI_BASE_URL` | 可选。OpenAI-compatible API 地址，默认 `https://api.openai.com/v1`。 |
| `DATABASE_URL` | SQLite 数据库地址，默认可使用 `file:./dev.db`。 |
| `API_PORT` | API 端口，默认 `4000`。 |
| `WEB_PORT` | Vite Web 端口，默认 `5173`。 |
| `NODE_ENV` | 设置为 `production` 时，Fastify 可服务前端构建产物。 |

项目不会把 GitHub Token、OpenAI Key 或完整请求 headers 存入数据库。

## 部署

Render 单服务部署说明见 [docs/deployment.md](docs/deployment.md)。服务端部署后同一个服务会同时提供 Web 页面和 `/api/*` 接口；未配置 `OPENAI_API_KEY` 时会使用 mock 模型。
