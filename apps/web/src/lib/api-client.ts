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
    message: z.string(),
    evidence: z.string(),
    confidence: z.number()
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

function isDemoMode(): boolean {
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
    title: "Demo analysis for AI PR Reviewer",
    description: "Static GitHub Pages demo mode uses deterministic sample findings without a backend.",
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
        patch: "@@ demo patch omitted @@"
      },
      {
        path: "src/services/review-engine.test.ts",
        status: "modified",
        additions: 18,
        deletions: 2,
        changes: 20
      }
    ]
  };
  const report: AnalysisReport = {
    summary: `${reference.owner}/${reference.repo}#${reference.pullRequestNumber}: demo report. This static GitHub Pages build shows the review workflow without calling GitHub, the API server, or an AI provider.`,
    riskLevel: "medium",
    findings: [
      {
        id: `${taskId}:bug:edge-cases`,
        taskId,
        severity: "major",
        category: "bug",
        filePath: "src/services/review-engine.ts",
        title: "Validate review-engine edge cases",
        evidence: "The demo changed file has 110 total line changes in review-engine logic.",
        suggestion: "Check null inputs, empty diffs, and model timeout paths before merging.",
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
        title: "Confirm tests cover both success and failure paths",
        evidence: "A related test file is present in the demo snapshot.",
        suggestion: "Make sure tests cover schema validation failures and empty PR snapshots.",
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
        title: "Keep analysis orchestration easy to split",
        evidence: "The largest demo change is concentrated in one review-engine file.",
        suggestion: "Separate fetching, risk scoring, and model validation when the implementation grows.",
        confidence: 0.62,
        blocking: false,
        status: "open"
      }
    ],
    details: {
      reviewContextSummary: {
        files: [
          {
            path: "src/services/review-engine.ts",
            contextSources: [
              {
                type: "metadata",
                filePath: "src/services/review-engine.ts",
                description: "Changed file metadata from the pull request file list."
              },
              {
                type: "patch",
                filePath: "src/services/review-engine.ts",
                description: "Changed file patch from GitHub pull request files."
              },
              {
                type: "file_content",
                filePath: "src/services/review-engine.ts",
                description: "Repository file content at PR head commit, truncated by size limit."
              },
              {
                type: "test_candidate",
                filePath: "src/services/review-engine.ts",
                description: "Potential related test/spec paths inferred from the changed file path."
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
                description: "Changed file metadata from the pull request file list."
              },
              {
                type: "test_candidate",
                filePath: "src/services/review-engine.test.ts",
                description: "Changed file is itself a test/spec file."
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
            description: "Pull request metadata from GitHub."
          },
          {
            type: "metadata",
            filePath: "src/services/review-engine.ts",
            description: "Changed file metadata from the pull request file list."
          },
          {
            type: "patch",
            filePath: "src/services/review-engine.ts",
            description: "Changed file patch from GitHub pull request files."
          },
          {
            type: "file_content",
            filePath: "src/services/review-engine.ts",
            description: "Repository file content at PR head commit, truncated by size limit."
          },
          {
            type: "test_candidate",
            filePath: "src/services/review-engine.ts",
            description: "Potential related test/spec paths inferred from the changed file path."
          },
          {
            type: "metadata",
            filePath: "src/services/review-engine.test.ts",
            description: "Changed file metadata from the pull request file list."
          },
          {
            type: "test_candidate",
            filePath: "src/services/review-engine.test.ts",
            description: "Changed file is itself a test/spec file."
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
            message: "Large service-level change detected in review orchestration.",
            evidence: "src/services/review-engine.ts changed 110 line(s).",
            confidence: 0.72
          },
          {
            id: `${taskId}:console-log`,
            filePath: "src/services/review-engine.ts",
            ruleId: "console-log",
            category: "maintainability",
            severity: "low",
            message: "Debug logging pattern detected in changed context.",
            evidence: "console.log(\"analysis started\")",
            confidence: 0.62
          },
          {
            id: `${taskId}:test-present`,
            filePath: "src/services/review-engine.test.ts",
            ruleId: "test-context-present",
            category: "test",
            severity: "low",
            message: "Related test file is part of this PR.",
            evidence: "src/services/review-engine.test.ts changed 20 line(s).",
            confidence: 0.7
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
          "MEDIUM large-change in src/services/review-engine.ts: Large service-level change detected in review orchestration.",
          "LOW console-log in src/services/review-engine.ts: Debug logging pattern detected in changed context.",
          "Skipped 2 generated/lock/build file(s) to reduce noise."
        ]
      },
      generatedAt: now
    }
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
