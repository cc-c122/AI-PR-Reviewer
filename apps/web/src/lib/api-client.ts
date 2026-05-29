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
  return request("/api/analysis-tasks", analysisTaskSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ pullRequestUrl })
  });
}

export async function getAnalysisReport(taskId: string): Promise<AnalysisReport> {
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
