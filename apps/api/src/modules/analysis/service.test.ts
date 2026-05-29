import { AnalysisDetails, AnalysisModelInput, AnalysisReport, AnalysisTask, PullRequestSnapshot } from "@ai-pr-reviewer/core";
import { describe, expect, it } from "vitest";
import { AnalysisTaskRepository } from "./repository";
import { AnalysisService } from "./service";

describe("AnalysisService report caching", () => {
  it("returns a persisted report without calling the model", async () => {
    const report = createReport("cached summary");
    const details = createDetails();
    const repository = new InMemoryAnalysisTaskRepository({
      ...createTask(),
      report
    });
    repository.details = details;
    const service = new AnalysisService({
      repository,
      githubClient: missingGitHubClient(),
      reviewModelClient: {
        async generateReview() {
          throw new Error("Model should not be called when report is cached.");
        }
      }
    });

    await expect(service.getReport("task_123")).resolves.toEqual({
      ...report,
      details
    });
    expect(repository.savedReports).toHaveLength(0);
  });

  it("generates and saves a report when no persisted report exists", async () => {
    const report = createReport("generated summary");
    const repository = new InMemoryAnalysisTaskRepository(createTask());
    const service = new AnalysisService({
      repository,
      githubClient: missingGitHubClient(),
      reviewModelClient: {
        async generateReview(input: AnalysisModelInput) {
          expect(input.snapshot.taskId).toBe("task_123");
          return report;
        }
      }
    });

    await expect(service.getReport("task_123")).resolves.toMatchObject(report);
    expect(repository.savedReports).toEqual([{ taskId: "task_123", report }]);
    expect(repository.savedDetails).toHaveLength(1);
    expect(repository.savedDetails[0]?.details.reviewContextSummary.files[0]).toMatchObject({
      path: "src/widget.ts",
      contentAvailable: false
    });
  });

  it("passes the enriched review context to the model input", async () => {
    const repository = new InMemoryAnalysisTaskRepository(createTask());
    const service = new AnalysisService({
      repository,
      githubClient: missingGitHubClient(),
      reviewModelClient: {
        async generateReview(input: AnalysisModelInput) {
          expect(input.reviewContext.changedFiles[0]).toMatchObject({
            path: "src/widget.ts",
            patch: "@@ -1 +1 @@"
          });

          return createReport("context summary");
        }
      }
    });

    await expect(service.getReport("task_123")).resolves.toMatchObject(createReport("context summary"));
  });

  it("returns saved details with a cached report", async () => {
    const report = createReport("cached summary");
    const details = createDetails();
    const repository = new InMemoryAnalysisTaskRepository({
      ...createTask(),
      report
    });
    repository.details = details;
    const service = new AnalysisService({
      repository,
      githubClient: missingGitHubClient(),
      reviewModelClient: {
        async generateReview() {
          throw new Error("Model should not be called when report is cached.");
        }
      }
    });

    await expect(service.getReport("task_123")).resolves.toEqual({
      ...report,
      details
    });
  });
});

class InMemoryAnalysisTaskRepository implements AnalysisTaskRepository {
  readonly savedReports: Array<{ taskId: string; report: AnalysisReport }> = [];
  readonly savedDetails: Array<{ taskId: string; details: AnalysisDetails }> = [];
  details: AnalysisDetails | null = null;

  constructor(private task: AnalysisTask | null) {}

  async saveTask(task: AnalysisTask): Promise<AnalysisTask> {
    this.task = task;
    return task;
  }

  async findTask(taskId: string): Promise<AnalysisTask | null> {
    return this.task?.taskId === taskId ? this.task : null;
  }

  async saveReport(taskId: string, report: AnalysisReport): Promise<AnalysisReport> {
    this.savedReports.push({ taskId, report });

    if (this.task?.taskId === taskId) {
      this.task = {
        ...this.task,
        report
      };
    }

    return report;
  }

  async saveAnalysisDetails(taskId: string, details: AnalysisDetails): Promise<AnalysisDetails> {
    this.savedDetails.push({ taskId, details });
    this.details = details;

    return details;
  }

  async findAnalysisDetails(taskId: string): Promise<AnalysisDetails | null> {
    return this.task?.taskId === taskId ? this.details : null;
  }
}

function createTask(): AnalysisTask {
  const snapshot = createSnapshot();

  return {
    taskId: "task_123",
    status: "completed",
    repositoryOwner: snapshot.repositoryOwner,
    repositoryName: snapshot.repositoryName,
    pullRequestNumber: snapshot.pullRequestNumber,
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
    snapshot
  };
}

function createSnapshot(): PullRequestSnapshot {
  return {
    id: "snapshot_123",
    taskId: "task_123",
    repositoryOwner: "acme",
    repositoryName: "widgets",
    pullRequestNumber: 7,
    url: "https://github.com/acme/widgets/pull/7",
    title: "Improve widgets",
    description: "Improves widget behavior.",
    author: "octocat",
    baseRef: "main",
    baseSha: "abc123456789",
    headRef: "feature/widgets",
    commitSha: "def123456789",
    changedFiles: [
      {
        path: "src/widget.ts",
        status: "modified",
        additions: 25,
        deletions: 5,
        changes: 30,
        patch: "@@ -1 +1 @@"
      }
    ]
  };
}

function createReport(summary: string): AnalysisReport {
  return {
    summary,
    riskLevel: "medium",
    findings: []
  };
}

function createDetails(): AnalysisDetails {
  return {
    reviewContextSummary: {
      files: [
        {
          path: "src/widget.ts",
          contextSources: [
            {
              type: "patch",
              filePath: "src/widget.ts",
              description: "Changed file patch from GitHub pull request files."
            }
          ],
          contentAvailable: false,
          contentTruncated: false,
          isTestFile: false,
          testCandidatePaths: ["src/widget.test.ts"]
        }
      ],
      contextSources: [
        {
          type: "metadata",
          description: "Pull request metadata from GitHub."
        }
      ]
    },
    staticAnalysis: {
      signals: [],
      skippedFiles: [],
      riskHints: []
    },
    generatedAt: "2026-05-29T00:00:00.000Z"
  };
}

function missingGitHubClient() {
  return null as never;
}
