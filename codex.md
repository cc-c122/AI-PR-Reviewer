# AI 代码评审工具开发说明书

## 1. 项目目标

本项目旨在开发一个面向开发团队的 AI 代码评审工具，帮助开发者提升 GitHub Pull Request 的 Review 效率与质量。工具应能够在用户指定 GitHub PR 后，自动获取代码变更、补充必要上下文、调用 AI 模型进行结构化分析，并输出可执行、可追踪、低噪声的评审结果。

项目不是要替代人工 Review，而是作为 Review Copilot 辅助开发者快速理解变更、识别高风险代码、发现潜在缺陷、生成审查建议，并帮助 Review 方把注意力集中在真正值得人工判断的地方。

核心目标如下：

1. 降低 Review 理解成本：自动生成 PR 变更总结、模块影响范围、关键文件说明。
2. 提升问题发现能力：识别潜在 bug、安全风险、性能风险、并发问题、异常处理缺失、测试缺口等。
3. 控制误报与漏报：通过上下文检索、规则约束、置信度标注、证据引用和分级输出减少无效建议。
4. 保持响应速度：对大型 PR 采用分块分析、增量缓存、并行任务和优先级调度。
5. 改善使用体验：提供清晰的 Web 界面、结构化报告、可复制 Review 建议，并支持后续接入 GitHub Review Comment。

## 2. 真实用户需求分析

开发者在代码评审中通常面临以下痛点：

1. PR 上下文不足  
   Review 者往往只看到 diff，但难以快速理解业务背景、调用链、相关测试和历史设计意图。

2. 大型 PR 难以聚焦  
   文件多、变更散时，人工很难判断哪些代码最值得优先 Review。

3. 重复性问题耗费精力  
   命名、空值处理、错误处理、测试覆盖、日志规范等问题经常重复出现，适合由 AI 或规则优先筛查。

4. 评审建议质量不稳定  
   好的 Review 应该指出问题、说明原因、给出建议，并尽量附带代码位置和影响范围。

5. AI 容易产生噪声  
   如果 AI 没有足够上下文，容易给出泛泛而谈、误报较高或不可执行的建议，反而增加 Review 负担。

因此，本工具应坚持以下产品原则：

1. 证据优先：每条问题必须尽量关联具体文件、行号、diff 片段或上下文依据。
2. 风险分级：区分阻塞问题、建议修改、可选优化和仅供参考的信息。
3. 少而准：默认输出高价值结果，避免生成大量泛化建议。
4. 人在回路：AI 只辅助判断，不直接代表最终 Review 结论。
5. 可解释：说明模型为什么认为某处有风险，以及建议如何验证。

## 3. 核心功能范围

### 3.1 PR 获取与解析

用户输入 GitHub PR URL 或仓库、PR 编号后，系统应完成：

1. 调用 GitHub API 获取 PR 元数据：标题、描述、作者、目标分支、源分支、提交列表、变更文件列表。
2. 获取 PR diff 或 patch。
3. 获取相关文件完整内容，必要时获取相邻代码上下文。
4. 获取已有评论、CI 状态、测试结果和关联 issue 信息。
5. 对变更按文件、语言、模块、风险类型进行归类。

### 3.2 PR 变更总结

系统应生成结构化总结：

1. 本次 PR 的主要目的。
2. 关键变更点。
3. 影响模块。
4. 数据结构、接口、配置、依赖、权限、数据库迁移等重要变化。
5. Review 建议关注点。

### 3.3 风险代码识别

系统应识别并标注以下风险：

1. 逻辑错误：边界条件、空值处理、条件判断、循环、状态更新。
2. 安全风险：注入、鉴权绕过、敏感信息泄露、不安全反序列化、权限控制缺失。
3. 性能风险：重复查询、低效循环、大对象复制、阻塞调用、不必要的同步操作。
4. 并发风险：竞态条件、锁使用不当、共享状态修改、异步流程异常。
5. 兼容性风险：接口破坏、配置变更、数据库 schema 变更、依赖升级影响。
6. 可维护性风险：复杂度升高、职责混乱、重复代码、异常处理不一致。
7. 测试风险：关键路径无测试、测试断言不足、缺少异常分支覆盖。

### 3.4 Review 建议生成

每条建议应尽量包含：

1. 严重级别：`critical`、`major`、`minor`、`info`。
2. 类型：bug、安全、性能、可维护性、测试、文档、风格。
3. 文件路径与行号。
4. 问题说明。
5. 触发依据。
6. 修改建议。
7. 置信度。
8. 是否建议阻塞合并。

示例结构：

```json
{
  "severity": "major",
  "category": "bug",
  "file": "src/services/order.ts",
  "line": 128,
  "title": "可能遗漏空值处理",
  "evidence": "新增代码直接读取 user.profile.id，但调用方允许 user.profile 为 null。",
  "suggestion": "在访问前增加空值判断，或在上游收紧类型约束。",
  "confidence": 0.82,
  "blocking": true
}
```

### 3.5 报告展示

第一阶段提供 Web 页面展示分析结果，后续支持直接回写 GitHub。

报告应包含：

1. PR 概览。
2. 变更总结。
3. 风险热力图或风险列表。
4. 按严重级别排序的问题列表。
5. 按文件分组的问题视图。
6. 可复制的 Review Comment。
7. 模型分析说明与上下文来源。

## 4. 技术栈

### 4.1 前端

推荐技术栈：

1. React
2. TypeScript
3. Vite
4. Tailwind CSS
5. shadcn/ui 或轻量自定义组件
6. TanStack Query

选择理由：

1. React 与 TypeScript 适合构建交互式 Review Dashboard。
2. Vite 启动快，适合开发阶段快速迭代。
3. TanStack Query 适合处理 PR 分析任务的异步状态、轮询和缓存。
4. Tailwind CSS 能快速建立一致 UI，同时保持样式可控。

### 4.2 后端

推荐技术栈：

1. Node.js
2. TypeScript
3. Fastify 或 NestJS
4. Octokit
5. Zod
6. Prisma

选择理由：

1. TypeScript 前后端统一类型系统，减少接口不一致。
2. Fastify 轻量高性能，适合作为 API 服务；若项目复杂度提升，可切换或扩展为 NestJS。
3. Octokit 是 GitHub API 的官方生态核心库。
4. Zod 用于请求参数、模型输出和配置校验。
5. Prisma 便于管理分析任务、缓存、报告和用户信息。

### 4.3 AI 与检索

推荐技术栈：

1. OpenAI API 或兼容模型供应商接口
2. LangChain/LlamaIndex 可选，不作为第一阶段强依赖
3. pgvector 或 SQLite 向量扩展，可作为后续语义检索能力
4. tree-sitter 用于代码结构解析
5. simple-git 用于本地仓库操作

第一阶段建议直接实现轻量编排层，而非过早引入复杂 Agent 框架。原因是代码评审需要稳定、可解释、可测试的流程，过度自动化会增加不可控性。

### 4.4 存储与任务

开发阶段：

1. SQLite
2. Prisma
3. 本地文件缓存

生产阶段可扩展为：

1. PostgreSQL
2. Redis
3. BullMQ
4. 对象存储

## 5. 模型选择设计

模型选择应遵循“准确性、成本、速度、上下文长度”平衡原则。

### 5.1 默认模型策略

1. 快速总结模型  
   用于 PR 概览、文件变更摘要、低风险任务。要求响应快、成本低。

2. 深度审查模型  
   用于高风险文件、核心业务逻辑、安全相关代码、复杂 diff。要求推理能力强、上下文理解好。

3. 结构化输出模型  
   所有最终建议必须经过 JSON Schema 或 Zod 校验，避免不可解析输出。

### 5.2 分层分析流程

1. 预分析阶段  
   解析 PR 元数据、文件类型、变更规模和风险信号。

2. 文件级分析阶段  
   对每个变更文件生成摘要，识别初步风险。

3. 上下文增强阶段  
   针对高风险片段检索完整函数、调用方、被调用方、类型定义、测试文件和配置文件。

4. 深度审查阶段  
   将 diff、相关上下文、项目规范和历史线索传入模型，生成候选问题。

5. 降噪与校验阶段  
   通过规则、二次模型验证、静态分析结果和置信度阈值过滤低质量建议。

6. 报告生成阶段  
   生成面向开发者的最终报告。

## 6. 上下文获取方式

为了提升准确性，不能只把 diff 直接交给模型。系统应采用多层上下文获取策略。

### 6.1 必须获取的上下文

1. PR 标题与描述。
2. Changed files diff。
3. 变更文件完整内容。
4. 变更行所在函数或类。
5. 相关测试文件。
6. package、配置、CI、lint 和测试命令。

### 6.2 按需获取的上下文

1. 调用方与被调用方。
2. 类型定义、接口定义、数据库模型。
3. 近期相关提交。
4. 已有 Review 评论。
5. 关联 issue 或需求描述。
6. 项目规范文档，例如 README、CONTRIBUTING、架构文档。

### 6.3 上下文预算控制

当 PR 较大时，需要控制模型上下文：

1. 优先保留 changed lines。
2. 保留变更所在函数或类。
3. 保留直接依赖的类型定义。
4. 对低风险文件只传摘要。
5. 对重复模式进行合并描述。
6. 对超大文件按函数或语义块切分。

## 7. 误报与漏报控制

### 7.1 降低误报

1. 每条建议必须引用证据。
2. 模型输出必须包含置信度。
3. 对低置信度建议默认归类为 `info` 或隐藏。
4. 对风格类建议默认不阻塞。
5. 与静态分析、测试结果或类型检查结果交叉验证。
6. 对同一问题进行去重合并。

### 7.2 降低漏报

1. 对高风险文件使用更强模型。
2. 对安全、鉴权、支付、数据迁移、并发等领域设置规则扫描。
3. 根据文件类型选择不同审查提示词。
4. 对缺少测试的高风险变更单独提示。
5. 对配置和依赖变更进行专门分析。

### 7.3 输出分级

1. `critical`：高度可能导致安全事故、数据损坏、线上故障，应阻塞合并。
2. `major`：可能导致 bug、兼容性问题或明显质量风险，建议修复后合并。
3. `minor`：可维护性、可读性、局部优化建议。
4. `info`：背景说明、提醒或需要人工确认的问题。

## 8. 响应速度设计

系统需要在准确性和速度之间平衡。

优化策略：

1. PR 元数据、diff、文件内容并行获取。
2. 文件级摘要并行生成。
3. 缓存仓库文件、commit 内容、分析结果和模型中间摘要。
4. 先返回 PR 总结和高风险文件列表，再逐步展示深度建议。
5. 对大 PR 采用任务队列与前端轮询。
6. 根据文件变更大小动态选择模型和上下文范围。
7. 跳过锁文件、构建产物、自动生成文件，除非它们本身构成风险。

## 9. 用户体验设计

### 9.1 入口流程

1. 用户输入 GitHub PR URL。
2. 系统校验 URL 与权限。
3. 系统创建分析任务。
4. 页面展示分析进度。
5. 分阶段显示结果：概览、风险、建议、可复制评论。

### 9.2 结果页面

页面应面向 Review 工作流，而不是展示 AI 炫技。重点是帮助用户快速判断：

1. 这个 PR 改了什么。
2. 哪些文件最值得看。
3. 哪些问题可能阻塞合并。
4. 哪些建议可以直接评论。
5. 哪些结果只是提醒，需要人工确认。

### 9.3 建议交互

1. 按严重级别筛选。
2. 按文件筛选。
3. 标记为有用、误报、已处理。
4. 复制为 GitHub 评论。
5. 后续支持一键发布 Review Comment。

## 10. 推荐目录结构

```text
AI-PR-Reviewer/
  codex.md
  README.md
  package.json
  pnpm-workspace.yaml
  .env.example
  .gitignore
  apps/
    web/
      src/
        app/
        components/
        features/
        hooks/
        lib/
        styles/
      index.html
      package.json
      vite.config.ts
    api/
      src/
        main.ts
        config/
        modules/
          github/
          analysis/
          reviews/
          reports/
          tasks/
        shared/
          errors/
          logger/
          schemas/
          types/
      package.json
      tsconfig.json
  packages/
    core/
      src/
        analysis/
        context/
        prompts/
        risk/
        schemas/
        types/
      package.json
    github/
      src/
        client.ts
        pull-request.ts
        repository.ts
      package.json
    model/
      src/
        client.ts
        providers/
        prompts/
        validators/
      package.json
    static-analysis/
      src/
        tree-sitter/
        rules/
        scanners/
      package.json
  prisma/
    schema.prisma
    migrations/
  docs/
    architecture.md
    model-strategy.md
    prompt-guidelines.md
    review-taxonomy.md
  tests/
    fixtures/
    integration/
    e2e/
```

## 11. 模块职责

### 11.1 `apps/web`

负责用户界面：

1. PR URL 输入。
2. 分析任务状态展示。
3. PR 总结展示。
4. 风险列表和建议列表展示。
5. 结果筛选、复制、反馈。

### 11.2 `apps/api`

负责后端 API：

1. 用户请求校验。
2. GitHub 权限与数据获取。
3. 分析任务创建与调度。
4. 报告查询。
5. 前端接口聚合。

### 11.3 `packages/core`

负责核心分析流程：

1. PR 解析。
2. 上下文选择。
3. 风险评分。
4. 分析编排。
5. 结果合并与去重。

### 11.4 `packages/github`

负责 GitHub 集成：

1. PR 元数据获取。
2. diff 获取。
3. 文件内容获取。
4. Review Comment 发布。
5. GitHub API 错误处理。

### 11.5 `packages/model`

负责模型调用：

1. 模型供应商适配。
2. Prompt 管理。
3. Token 预算。
4. JSON Schema 输出校验。
5. 重试、限流和超时处理。

### 11.6 `packages/static-analysis`

负责静态分析辅助：

1. 代码结构解析。
2. 规则扫描。
3. 安全模式识别。
4. 测试缺口识别。
5. 与 AI 输出交叉验证。

## 12. 数据模型草案

### 12.1 AnalysisTask

```ts
type AnalysisTask = {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
};
```

### 12.2 PullRequestSnapshot

```ts
type PullRequestSnapshot = {
  id: string;
  taskId: string;
  title: string;
  description: string;
  baseRef: string;
  headRef: string;
  commitSha: string;
  changedFiles: ChangedFile[];
};
```

### 12.3 ReviewFinding

```ts
type ReviewFinding = {
  id: string;
  taskId: string;
  severity: "critical" | "major" | "minor" | "info";
  category: "bug" | "security" | "performance" | "maintainability" | "test" | "docs" | "style";
  filePath: string;
  line?: number;
  title: string;
  evidence: string;
  suggestion: string;
  confidence: number;
  blocking: boolean;
  status: "open" | "dismissed" | "accepted";
};
```

## 13. API 设计草案

### 13.1 创建分析任务

```http
POST /api/analysis-tasks
Content-Type: application/json

{
  "pullRequestUrl": "https://github.com/org/repo/pull/123"
}
```

响应：

```json
{
  "taskId": "task_123",
  "status": "queued"
}
```

### 13.2 查询任务状态

```http
GET /api/analysis-tasks/:taskId
```

响应：

```json
{
  "taskId": "task_123",
  "status": "running",
  "progress": {
    "stage": "analyzing_files",
    "completedFiles": 8,
    "totalFiles": 21
  }
}
```

### 13.3 获取分析报告

```http
GET /api/analysis-tasks/:taskId/report
```

响应：

```json
{
  "summary": "...",
  "riskLevel": "medium",
  "findings": []
}
```

## 14. Prompt 设计规范

所有 Prompt 必须遵守以下要求：

1. 明确角色：模型是代码评审助手，不是代码作者。
2. 明确任务边界：只基于提供的代码和上下文判断，不能臆造不存在的信息。
3. 强制结构化输出：使用 JSON Schema 或 Zod schema 校验。
4. 要求证据引用：每条建议必须说明依据。
5. 要求不确定性表达：不确定时输出需要人工确认，而不是给出绝对结论。
6. 限制泛化建议：避免“建议增加日志”“建议优化可读性”这类没有具体位置和原因的内容。
7. 区分阻塞和非阻塞：明确是否建议阻塞合并。

## 15. 安全与权限

1. GitHub Token 必须通过环境变量或安全配置注入，不得写入代码仓库。
2. 不在日志中输出 Token、私有仓库代码片段或敏感环境变量。
3. 对用户输入的 PR URL 进行严格校验。
4. 对 GitHub API 请求进行限流与错误处理。
5. 模型请求前应进行敏感信息脱敏策略设计。
6. 私有仓库分析结果默认只对授权用户可见。

## 16. 开发规范

### 16.1 代码规范

1. 全项目使用 TypeScript。
2. 严格启用 `strict` 类型检查。
3. 业务对象使用明确类型，不使用裸 `any`。
4. 外部输入必须经过 Zod 校验。
5. 错误处理必须包含可定位的错误类型和上下文。
6. 日志应结构化，避免输出敏感数据。
7. 复杂逻辑必须拆分为可测试的纯函数或小模块。

### 16.2 Git 规范

1. 分支命名推荐：`feature/xxx`、`fix/xxx`、`chore/xxx`。
2. Commit message 推荐使用 Conventional Commits：
   - `feat: add pull request analysis task`
   - `fix: handle github rate limit errors`
   - `chore: update lint config`
3. 每个 PR 应说明功能、测试方式和潜在风险。

### 16.3 测试规范

必须覆盖：

1. PR URL 解析。
2. GitHub API 数据适配。
3. diff 解析。
4. 上下文裁剪。
5. 模型输出 schema 校验。
6. finding 去重与排序。
7. API 状态流转。

测试类型：

1. 单元测试：核心纯函数、schema、解析器。
2. 集成测试：GitHub client、分析任务流程。
3. 端到端测试：用户输入 PR URL 到看到报告。
4. 快照测试：Prompt 输出结构和报告结构。

### 16.4 UI 规范

1. 界面应以 Review 工作流为中心，而不是营销页面。
2. 第一屏应直接提供 PR 输入和最近分析任务。
3. 报告页应优先展示关键结论和高风险问题。
4. 严重级别使用清晰视觉区分，但避免过度装饰。
5. 所有长文本都应支持折叠或分段展示。
6. 加载过程应展示阶段性进度。

### 16.5 AI 输出质量规范

1. 不输出没有证据的确定性结论。
2. 不把代码风格偏好包装成严重问题。
3. 不对未提供上下文的业务逻辑做过度推断。
4. 同一问题只保留最清晰的一条建议。
5. 对可能误报的建议明确标注“需要人工确认”。
6. 阻塞级建议必须具备明确风险和较高置信度。

## 17. 第一阶段里程碑

### 17.1 MVP

目标：完成从 GitHub PR 到 AI Review 报告的闭环。

范围：

1. 支持输入公开 GitHub PR URL。
2. 获取 PR 元数据和 diff。
3. 生成 PR 总结。
4. 生成文件级风险列表。
5. 生成结构化 Review 建议。
6. Web 页面展示报告。
7. 支持复制建议为 GitHub 评论。

### 17.2 第二阶段

目标：提升准确性和上下文理解。

范围：

1. 支持私有仓库 Token。
2. 获取完整文件和相关测试。
3. 引入 tree-sitter 分析函数级上下文。
4. 引入静态规则扫描。
5. 支持用户反馈误报。

### 17.3 第三阶段

目标：团队协作与自动化。

范围：

1. 支持 GitHub App。
2. 支持自动评论到 PR。
3. 支持组织级规则配置。
4. 支持历史 Review 数据学习。
5. 支持多模型策略和成本控制。

## 18. 未来扩展方向

1. GitHub App 集成  
   在 PR 创建或更新时自动触发分析，并将结果写回 Checks 或 Review Comments。

2. 多代码托管平台  
   支持 GitLab、Gitea、Bitbucket。

3. 团队规则库  
   允许团队配置自定义规则、架构约束、命名规范和安全基线。

4. 历史上下文学习  
   从历史 PR、issue、事故复盘和 Review 评论中提取团队偏好与风险模式。

5. IDE 插件  
   在开发者提交 PR 前提前分析变更，减少 Review 往返。

6. 自动修复建议  
   对低风险问题生成 patch，但必须由开发者确认后应用。

7. 质量指标看板  
   统计误报率、采纳率、平均 Review 时间、问题类型分布和高风险模块。

## 19. 验收标准

MVP 完成时应满足：

1. 能输入 GitHub PR URL 并创建分析任务。
2. 能正确解析 GitHub PR 的 owner、repo 和 PR number。
3. 能获取 PR 元数据和变更文件。
4. 能生成结构化 PR 总结。
5. 能输出至少三类风险识别结果：bug、测试缺口、可维护性。
6. Review 建议必须包含文件、说明、建议、严重级别和置信度。
7. 前端能展示任务状态和最终报告。
8. 后端关键模块具备单元测试。
9. 敏感信息不进入日志。
10. 项目 README 能说明启动方式和环境变量。

## 20. 非目标

第一阶段不追求：

1. 完全替代人工 Review。
2. 对所有语言提供同等深度的语义分析。
3. 自动修改代码并提交。
4. 在没有权限控制的情况下分析私有仓库。
5. 生成大量低置信度风格建议。

## 21. 总结

本项目的核心价值在于用 AI 降低 Pull Request 理解成本，并辅助发现高价值问题。实现过程中应始终坚持：上下文充分、输出结构化、建议有证据、风险有分级、体验服务于真实 Review 流程。

后续所有功能开发都应以本文档作为项目约束和设计依据。当实现方案与本文档发生冲突时，应优先更新本文档并说明原因，再调整代码。
