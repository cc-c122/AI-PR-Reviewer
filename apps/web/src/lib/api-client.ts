import { z } from "zod";

const changedFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  previousPath: z.string().optional(),
  patch: z.string().optional()
});

const pullRequestSnapshotSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  repositoryOwner: z.string(),
  repositoryName: z.string(),
  pullRequestNumber: z.number(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  author: z.string(),
  baseRef: z.string(),
  baseSha: z.string(),
  headRef: z.string(),
  commitSha: z.string(),
  changedFiles: z.array(changedFileSchema)
});

const reviewFindingSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  severity: z.enum(["critical", "major", "minor", "info"]),
  category: z.enum(["bug", "security", "performance", "maintainability", "test", "docs", "style"]),
  filePath: z.string(),
  line: z.number().optional(),
  title: z.string(),
  evidence: z.string(),
  suggestion: z.string(),
  confidence: z.number(),
  blocking: z.boolean(),
  status: z.enum(["open", "dismissed", "accepted"]).optional()
});

const contextSourceSchema = z.object({
  type: z.enum(["metadata", "patch", "file_content", "test_candidate"]),
  description: z.string(),
  filePath: z.string().optional()
});

const staticAnalysisSchema = z.object({
  signals: z.array(z.object({
    id: z.string(),
    filePath: z.string(),
    ruleId: z.string(),
    category: z.enum(["security", "maintainability", "test", "size"]),
    severity: z.enum(["low", "medium", "high"]),
    source: z.enum(["introduced_by_pr", "context_only"]),
    needsHumanConfirmation: z.boolean(),
    message: z.string(),
    evidence: z.string(),
    confidence: z.number(),
    line: z.number().optional()
  })),
  skippedFiles: z.array(z.object({
    filePath: z.string(),
    reason: z.enum(["generated", "lockfile", "build_artifact"])
  })),
  riskHints: z.array(z.string())
});

const analysisDetailsSchema = z.object({
  reviewContextSummary: z.object({
    files: z.array(z.object({
      path: z.string(),
      contextSources: z.array(contextSourceSchema),
      contentAvailable: z.boolean(),
      contentTruncated: z.boolean(),
      isTestFile: z.boolean(),
      testCandidatePaths: z.array(z.string())
    })),
    contextSources: z.array(contextSourceSchema)
  }),
  staticAnalysis: staticAnalysisSchema,
  generatedAt: z.string()
});

const analysisReportSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "unknown"]),
  findings: z.array(reviewFindingSchema),
  details: analysisDetailsSchema.optional()
});

const analysisTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  repositoryOwner: z.string(),
  repositoryName: z.string(),
  pullRequestNumber: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  snapshot: pullRequestSnapshotSchema.optional(),
  report: analysisReportSchema.optional(),
  errorMessage: z.string().optional()
});

const apiErrorSchema = z.object({
  message: z.string()
});

export type PullRequestSnapshot = z.infer<typeof pullRequestSnapshotSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type AnalysisReport = z.infer<typeof analysisReportSchema>;
export type AnalysisTask = z.infer<typeof analysisTaskSchema>;

export type AnalysisResult = {
  task: AnalysisTask;
  report: AnalysisReport;
};

export async function createAnalysisTask(pullRequestUrl: string): Promise<AnalysisTask> {
  if (isDemoMode()) {
    return createDemoAnalysis(pullRequestUrl).task;
  }

  return request("/api/analysis-tasks", analysisTaskSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ pullRequestUrl })
  });
}

export async function getAnalysisReport(taskId: string): Promise<AnalysisReport> {
  if (isDemoMode()) {
    const demo = getDemoAnalysis(taskId);

    if (!demo) {
      throw new Error("Demo analysis task was not found.");
    }

    return demo.report;
  }

  return request(`/api/analysis-tasks/${encodeURIComponent(taskId)}/report`, analysisReportSchema);
}

export async function analyzePullRequest(pullRequestUrl: string): Promise<AnalysisResult> {
  const task = await createAnalysisTask(pullRequestUrl);
  const report = await getAnalysisReport(task.taskId);

  return {
    task,
    report
  };
}

const demoAnalyses = new Map<string, AnalysisResult>();

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

function getDemoAnalysis(taskId: string): AnalysisResult | undefined {
  return demoAnalyses.get(taskId);
}

function createDemoAnalysis(pullRequestUrl: string): AnalysisResult {
  const reference = parseDemoPullRequestUrl(pullRequestUrl);
  const now = new Date().toISOString();
  const taskId = `demo-${reference.owner}-${reference.repo}-${reference.pullRequestNumber}`;
  const snapshot: PullRequestSnapshot = {
    id: `snapshot-${taskId}`,
    taskId,
    repositoryOwner: reference.owner,
    repositoryName: reference.repo,
    pullRequestNumber: reference.pullRequestNumber,
    url: pullRequestUrl,
    title: "AI PR Reviewer 演示分析",
    description: "静态 GitHub Pages Demo 模式使用固定示例结果，不依赖后端服务。",
    author: "demo-user",
    baseRef: "main",
    baseSha: "a1b2c3d4e5f6",
    headRef: "feature/demo-review",
    commitSha: "f6e5d4c3b2a1",
    changedFiles: [
      {
        path: "src/services/review-engine.ts",
        status: "modified",
        additions: 86,
        deletions: 24,
        changes: 110,
        patch: "@@ -40,0 +42,2 @@\n+console.log(\"analysis started\")\n+return analyze(input)"
      },
      {
        path: "src/services/review-engine.test.ts",
        status: "modified",
        additions: 18,
        deletions: 2,
        changes: 20,
        patch: "@@ -16,0 +18,1 @@\n+expect(report.findings).toHaveLength(3)"
      }
    ]
  };
  const report: AnalysisReport = {
    summary: `${reference.owner}/${reference.repo}#${reference.pullRequestNumber}: 这是 Demo 报告。当前静态 GitHub Pages 构建会展示 Review 工作流，但不会调用 GitHub、API 服务或 AI 模型。`,
    riskLevel: "medium",
    findings: [
      {
        id: `${taskId}:bug:edge-cases`,
        taskId,
        severity: "major",
        category: "bug",
        filePath: "src/services/review-engine.ts",
        line: 42,
        title: "检查 review-engine 的边界场景",
        evidence: "Demo 变更文件在 review-engine 逻辑中共有 110 行改动。",
        suggestion: "合并前请确认空输入、空 diff 和模型超时路径都已被覆盖。",
        confidence: 0.74,
        blocking: true,
        status: "open"
      },
      {
        id: `${taskId}:test:coverage`,
        taskId,
        severity: "info",
        category: "test",
        filePath: "src/services/review-engine.test.ts",
        line: 18,
        title: "确认测试覆盖成功和失败路径",
        evidence: "Demo 快照中包含相关测试文件。",
        suggestion: "请确认测试覆盖 schema 校验失败和空 PR 快照等场景。",
        confidence: 0.67,
        blocking: false,
        status: "open"
      },
      {
        id: `${taskId}:maintainability:scope`,
        taskId,
        severity: "minor",
        category: "maintainability",
        filePath: "src/services/review-engine.ts",
        title: "保持分析编排逻辑便于拆分",
        evidence: "Demo 中最大的改动集中在一个 review-engine 文件内。",
        suggestion: "当实现继续增长时，建议将数据获取、风险评分和模型校验拆分到清晰边界中。",
        confidence: 0.62,
        blocking: false,
        status: "open"
      }
    ],
    details: createDemoDetails(taskId, now)
  };
  const task: AnalysisTask = {
    taskId,
    status: "completed",
    repositoryOwner: reference.owner,
    repositoryName: reference.repo,
    pullRequestNumber: reference.pullRequestNumber,
    createdAt: now,
    updatedAt: now,
    snapshot,
    report
  };
  const result = { task, report };

  demoAnalyses.set(taskId, result);

  return result;
}

function createDemoDetails(taskId: string, generatedAt: string): NonNullable<AnalysisReport["details"]> {
  return {
    reviewContextSummary: {
      files: [
        {
          path: "src/services/review-engine.ts",
          contextSources: [
            {
              type: "metadata",
              filePath: "src/services/review-engine.ts",
              description: "来自 Pull Request 文件列表的变更文件元数据。"
            },
            {
              type: "patch",
              filePath: "src/services/review-engine.ts",
              description: "来自 GitHub Pull Request 文件接口的变更 patch。"
            },
            {
              type: "file_content",
              filePath: "src/services/review-engine.ts",
              description: "PR head commit 上的仓库文件内容，因大小限制已截断。"
            },
            {
              type: "test_candidate",
              filePath: "src/services/review-engine.ts",
              description: "根据变更文件路径推断出的潜在相关测试路径。"
            }
          ],
          contentAvailable: true,
          contentTruncated: true,
          isTestFile: false,
          testCandidatePaths: [
            "src/services/review-engine.test.ts",
            "src/services/review-engine.spec.ts",
            "tests/review-engine.test.ts"
          ]
        },
        {
          path: "src/services/review-engine.test.ts",
          contextSources: [
            {
              type: "metadata",
              filePath: "src/services/review-engine.test.ts",
              description: "来自 Pull Request 文件列表的变更文件元数据。"
            },
            {
              type: "test_candidate",
              filePath: "src/services/review-engine.test.ts",
              description: "变更文件本身就是测试或 spec 文件。"
            }
          ],
          contentAvailable: false,
          contentTruncated: false,
          isTestFile: true,
          testCandidatePaths: ["src/services/review-engine.test.ts"]
        }
      ],
      contextSources: [
        {
          type: "metadata",
          description: "来自 GitHub 的 Pull Request 元数据。"
        },
        {
          type: "metadata",
          filePath: "src/services/review-engine.ts",
          description: "来自 Pull Request 文件列表的变更文件元数据。"
        },
        {
          type: "patch",
          filePath: "src/services/review-engine.ts",
          description: "来自 GitHub Pull Request 文件接口的变更 patch。"
        },
        {
          type: "file_content",
          filePath: "src/services/review-engine.ts",
          description: "PR head commit 上的仓库文件内容，因大小限制已截断。"
        },
        {
          type: "test_candidate",
          filePath: "src/services/review-engine.ts",
          description: "根据变更文件路径推断出的潜在相关测试路径。"
        },
        {
          type: "metadata",
          filePath: "src/services/review-engine.test.ts",
          description: "来自 Pull Request 文件列表的变更文件元数据。"
        },
        {
          type: "test_candidate",
          filePath: "src/services/review-engine.test.ts",
          description: "变更文件本身就是测试或 spec 文件。"
        }
      ]
    },
    staticAnalysis: {
      signals: [
        {
          id: `${taskId}:large-change`,
          filePath: "src/services/review-engine.ts",
          ruleId: "large-change",
          category: "size",
          severity: "medium",
          source: "introduced_by_pr",
          needsHumanConfirmation: false,
          message: "检测到 review 编排中的服务级大改动。",
          evidence: "src/services/review-engine.ts 变更 110 行。",
          confidence: 0.72
        },
        {
          id: `${taskId}:console-log`,
          filePath: "src/services/review-engine.ts",
          ruleId: "console-log",
          category: "maintainability",
          severity: "low",
          source: "introduced_by_pr",
          needsHumanConfirmation: false,
          message: "在变更上下文中检测到调试日志模式。",
          evidence: "console.log(\"analysis started\")",
          confidence: 0.62,
          line: 42
        },
        {
          id: `${taskId}:test-present`,
          filePath: "src/services/review-engine.test.ts",
          ruleId: "test-context-present",
          category: "test",
          severity: "low",
          source: "introduced_by_pr",
          needsHumanConfirmation: false,
          message: "相关测试文件已包含在本次 PR 中。",
          evidence: "src/services/review-engine.test.ts 变更 20 行。",
          confidence: 0.7,
          line: 18
        },
        {
          id: `${taskId}:context-many-any`,
          filePath: "src/services/review-engine.ts",
          ruleId: "context-many-any",
          category: "maintainability",
          severity: "low",
          source: "context_only",
          needsHumanConfirmation: true,
          message: "相关文件上下文中存在较多 any，需要人工确认是否与本 PR 相关。",
          evidence: "相关文件上下文中存在 6 个 any，需确认是否与本 PR 相关。",
          confidence: 0.35
        }
      ],
      skippedFiles: [
        {
          filePath: "pnpm-lock.yaml",
          reason: "lockfile"
        },
        {
          filePath: "dist/assets/index.js",
          reason: "build_artifact"
        }
      ],
      riskHints: [
        "MEDIUM large-change in src/services/review-engine.ts: 检测到 review 编排中的服务级大改动。",
        "LOW console-log in src/services/review-engine.ts: 在变更上下文中检测到调试日志模式。",
        "LOW context-many-any in src/services/review-engine.ts: 相关上下文存在较多 any，需人工确认。",
        "已跳过 2 个生成文件、锁文件或构建产物，以减少噪声。"
      ]
    },
    generatedAt
  };
}

function parseDemoPullRequestUrl(value: string) {
  const url = new URL(value);
  const [owner, repo, resource, pullRequestNumber] = url.pathname.split("/").filter(Boolean);

  if (url.protocol !== "https:" || url.hostname !== "github.com" || resource !== "pull" || !owner || !repo) {
    throw new Error("Demo mode accepts GitHub PR URLs like https://github.com/org/repo/pull/123.");
  }

  const parsedPullRequestNumber = Number(pullRequestNumber);

  if (!Number.isInteger(parsedPullRequestNumber) || parsedPullRequestNumber <= 0) {
    throw new Error("Demo mode requires a numeric pull request number.");
  }

  return {
    owner,
    repo,
    pullRequestNumber: parsedPullRequestNumber
  };
}

async function request<T>(path: string, schema: z.Schema<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload: unknown = await parseResponse(response);

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload);
    throw new Error(error.success ? error.data.message : `Request failed with status ${response.status}.`);
  }

  return schema.parse(payload);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The API returned an invalid JSON response.");
  }
}
