import { describe, expect, it } from "vitest";
import { generateAnalysisReport } from "./report";
import { PullRequestSnapshot } from "../types/analysis";

describe("generateAnalysisReport", () => {
  it("builds model input from a pull request snapshot", async () => {
    const snapshot = createSnapshot();
    const report = await generateAnalysisReport(snapshot, {
      async generateReview(input) {
        expect(input.snapshot).toBe(snapshot);
        expect(input.summary).toContain("acme/widgets#7");
        expect(input.riskAssessment.riskLevel).toBe("medium");

        return {
          summary: input.summary,
          riskLevel: input.riskAssessment.riskLevel,
          findings: []
        };
      }
    });

    expect(report.summary).toContain("Improve widgets");
    expect(report.riskLevel).toBe("medium");
  });
});

function createSnapshot(): PullRequestSnapshot {
  return {
    id: "42",
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
        additions: 30,
        deletions: 10,
        changes: 40
      }
    ]
  };
}
