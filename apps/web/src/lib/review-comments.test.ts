import { describe, expect, it } from "vitest";
import { AnalysisReport, AnalysisTask, ReviewFinding } from "./api-client";
import { formatFindingComment, formatReviewSummary } from "./review-comments";

describe("review comment formatting", () => {
  it("formats a finding as a GitHub review comment draft", () => {
    expect(formatFindingComment(createFinding())).toContain("### Validate null handling");
    expect(formatFindingComment(createFinding())).toContain("**Severity / Category:** major / bug");
    expect(formatFindingComment(createFinding())).toContain("**Blocking:** yes");
    expect(formatFindingComment(createFinding())).toContain("Check boundary conditions.");
  });

  it("formats a full review summary with findings", () => {
    const report: AnalysisReport = {
      summary: "This PR touches widget behavior.",
      riskLevel: "medium",
      findings: [createFinding()]
    };
    const task: AnalysisTask = {
      taskId: "task_123",
      status: "completed",
      repositoryOwner: "acme",
      repositoryName: "widgets",
      pullRequestNumber: 7,
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
      snapshot: {
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
        baseSha: "abc123",
        headRef: "feature/widgets",
        commitSha: "def456",
        changedFiles: []
      }
    };

    const summary = formatReviewSummary(report, task);

    expect(summary).toContain("AI PR Review Summary for acme/widgets#7");
    expect(summary).toContain("https://github.com/acme/widgets/pull/7");
    expect(summary).toContain("Blocking findings:** 1");
    expect(summary).toContain("[major/bug/blocking] src/widget.ts: Validate null handling");
  });
});

function createFinding(): ReviewFinding {
  return {
    id: "finding_123",
    taskId: "task_123",
    severity: "major",
    category: "bug",
    filePath: "src/widget.ts",
    line: 42,
    title: "Validate null handling",
    evidence: "The changed path reads profile.id without checking profile.",
    suggestion: "Check boundary conditions.",
    confidence: 0.82,
    blocking: true,
    status: "open"
  };
}
