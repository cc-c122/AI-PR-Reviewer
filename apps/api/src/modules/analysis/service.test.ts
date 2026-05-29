import { AnalysisModelInput, AnalysisReport, AnalysisTask, PullRequestSnapshot } from "@ai-pr-reviewer/core";
import { describe, expect, it } from "vitest";
import { AnalysisTaskRepository } from "./repository";
import { AnalysisService } from "./service";

describe("AnalysisService report caching", () => {
  it("returns a persisted report without calling the model", async () => {
    const report = createReport("cached summary");
    const repository = new InMemoryAnalysisTaskRepository({
      ...createTask(),
      report
    });
    const service = new AnalysisService({
      repository,
      githubClient: missingGitHubClient(),
      reviewModelClient: {
        async generateReview() {
          throw new Error("Model should not be called when report is cached.");
        }
      }
    });

    await expect(service.getReport("task_123")).resolves.toEqual(report);
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

    await expect(service.getReport("task_123")).resolves.toEqual(report);
    expect(repository.savedReports).toEqual([{ taskId: "task_123", report }]);
  });
});

class InMemoryAnalysisTaskRepository implements AnalysisTaskRepository {
  readonly savedReports: Array<{ taskId: string; report: AnalysisReport }> = [];

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
        changes: 30
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

function missingGitHubClient() {
  return null as never;
}
