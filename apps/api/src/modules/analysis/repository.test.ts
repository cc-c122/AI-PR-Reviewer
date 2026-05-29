import { describe, expect, it } from "vitest";
import { mapAnalysisTaskRecord } from "./repository";

describe("mapAnalysisTaskRecord", () => {
  it("maps persisted task, snapshot, and report records to the API task shape", () => {
    const createdAt = new Date("2026-05-29T00:00:00.000Z");
    const updatedAt = new Date("2026-05-29T00:01:00.000Z");

    const task = mapAnalysisTaskRecord({
      id: "task_123",
      repositoryOwner: "acme",
      repositoryName: "widgets",
      pullRequestNumber: 7,
      status: "completed",
      errorMessage: null,
      createdAt,
      updatedAt,
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
        ],
        createdAt,
        updatedAt
      },
      report: {
        id: "report_123",
        taskId: "task_123",
        summary: "Widget review summary.",
        riskLevel: "medium",
        findings: [
          {
            id: "finding_123",
            taskId: "task_123",
            severity: "major",
            category: "bug",
            filePath: "src/widget.ts",
            title: "Review widget edge cases",
            evidence: "src/widget.ts changed 30 line(s).",
            suggestion: "Check boundary conditions.",
            confidence: 0.78,
            blocking: true,
            status: "open"
          }
        ],
        createdAt,
        updatedAt
      }
    });

    expect(task).toEqual({
      taskId: "task_123",
      status: "completed",
      repositoryOwner: "acme",
      repositoryName: "widgets",
      pullRequestNumber: 7,
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:01:00.000Z",
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
      },
      report: {
        summary: "Widget review summary.",
        riskLevel: "medium",
        findings: [
          {
            id: "finding_123",
            taskId: "task_123",
            severity: "major",
            category: "bug",
            filePath: "src/widget.ts",
            title: "Review widget edge cases",
            evidence: "src/widget.ts changed 30 line(s).",
            suggestion: "Check boundary conditions.",
            confidence: 0.78,
            blocking: true,
            status: "open"
          }
        ]
      }
    });
  });
});
