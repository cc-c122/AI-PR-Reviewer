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

const analysisReportSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "unknown"]),
  findings: z.array(reviewFindingSchema)
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
    ]
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
