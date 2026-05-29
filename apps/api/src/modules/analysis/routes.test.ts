import { AnalysisDetails, AnalysisReport, AnalysisTask } from "@ai-pr-reviewer/core";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AnalysisTaskRepository } from "./repository";
import { analysisRoutes } from "./routes";

describe("analysisRoutes", () => {
  it("returns report details from the report API", async () => {
    const report = createReport();
    const details = createDetails();
    const repository = new InMemoryAnalysisTaskRepository({
      ...createTask(),
      report
    }, details);
    const app = Fastify();

    await app.register(analysisRoutes, {
      prefix: "/api/analysis-tasks",
      repository,
      githubClient: null as never,
      reviewModelClient: {
        async generateReview() {
          throw new Error("Model should not be called for cached reports.");
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/analysis-tasks/task_123/report"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...report,
      details
    });
  });
});

class InMemoryAnalysisTaskRepository implements AnalysisTaskRepository {
  constructor(
    private readonly task: AnalysisTask | null,
    private readonly details: AnalysisDetails | null,
  ) {}

  async saveTask(task: AnalysisTask): Promise<AnalysisTask> {
    return task;
  }

  async findTask(taskId: string): Promise<AnalysisTask | null> {
    return this.task?.taskId === taskId ? this.task : null;
  }

  async saveReport(_taskId: string, report: AnalysisReport): Promise<AnalysisReport> {
    return report;
  }

  async saveAnalysisDetails(_taskId: string, details: AnalysisDetails): Promise<AnalysisDetails> {
    return details;
  }

  async findAnalysisDetails(taskId: string): Promise<AnalysisDetails | null> {
    return this.task?.taskId === taskId ? this.details : null;
  }
}

function createTask(): AnalysisTask {
  return {
    taskId: "task_123",
    status: "completed",
    repositoryOwner: "acme",
    repositoryName: "widgets",
    pullRequestNumber: 7,
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  };
}

function createReport(): AnalysisReport {
  return {
    summary: "Cached report.",
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
              type: "metadata",
              filePath: "src/widget.ts",
              description: "Changed file metadata from the pull request file list."
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
