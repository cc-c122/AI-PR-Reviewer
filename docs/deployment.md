# Deployment

## 当前公开入口

当前公开入口为 GitHub Pages 静态 Demo：

- https://cc-c122.github.io/AI-PR-Reviewer/

该版本使用浏览器内置 mock 数据，不会请求 GitHub API、后端服务或 AI 模型。它适合用于公开展示前端交互、报告结构、分析依据和评论草稿复制流程。

GitHub Pages workflow 只构建 `apps/web`，构建时设置：

```text
GITHUB_PAGES=true
VITE_DEMO_MODE=true
```

## 可选：部署完整服务端版本

如需部署完整服务端版本，可参考以下可选 Render 配置。该方案会用单个 Web Service 同时提供 Fastify API 和构建后的 React 页面。前端使用同源 `/api/*` 调用，因此不需要拆成独立 Vercel 前端和 API 地址。

## 可选 Render 配置

在 Render 中从本仓库创建一个新的 Web Service：

- Runtime: Node
- Build command: `pnpm render:build`
- Start command: `pnpm render:start`
- Instance type: Free

Render 会提供 `PORT` 环境变量。API 也支持 `API_PORT`，但在托管生产环境中优先使用 `PORT`。

## 环境变量

最小服务端配置：

```text
NODE_ENV=production
DATABASE_URL=file:./demo.db
```

可选配置：

```text
GITHUB_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
LOG_LEVEL=info
```

如果省略 `OPENAI_API_KEY`，服务端版本会使用 `MockReviewModelClient` 并返回确定性的结构化报告。公开 GitHub PR 在没有 `GITHUB_TOKEN` 时也可以尝试获取，但 API rate limit 会更低。

## 启动流程

`pnpm render:build` 会生成 Prisma client，并构建所有 workspace，包括 `apps/web/dist`。

`pnpm render:start` 会运行：

```bash
prisma migrate deploy || node scripts/apply-sqlite-schema.mjs && pnpm --filter @ai-pr-reviewer/api start
```

优先使用 Prisma migration。fallback 脚本会直接从 `prisma/migrations` 应用已提交的 SQLite schema，让受限环境中的服务也能启动。

Fastify 服务随后会：

- 提供 `/api/analysis-tasks/*` API routes。
- 提供 `/api/health` 健康检查。
- 在 production 中提供 `apps/web/dist` 静态文件。
- 对非 API 路由 fallback 到 `index.html`。

## SQLite 注意事项

Render Free filesystem 可用于轻量演示，但不应视为可靠的生产级持久化数据库。可选服务端部署可以使用 `DATABASE_URL=file:./demo.db`。Prisma 会从 `prisma/` 目录解析相对 SQLite 路径，因此该配置会创建 `prisma/demo.db`。SQLite 数据库文件已被 git ignore，不应提交到仓库。

不要把 GitHub token、OpenAI key、请求 headers 或其他敏感信息写入数据库。当前持久化层只保存任务元数据、PR snapshot、changed-file JSON、报告摘要、风险等级和 finding JSON。
