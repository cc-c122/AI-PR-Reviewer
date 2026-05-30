import { describe, expect, it } from "vitest";
import { mapAnalysisDetailsRecord, mapAnalysisTaskRecord } from "./repository";

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
        summary: "Widget 评审摘要。",
        riskLevel: "medium",
        findings: [
          {
            id: "finding_123",
            taskId: "task_123",
            severity: "major",
            category: "bug",
            filePath: "src/widget.ts",
            title: "检查 widget 边界场景",
            evidence: "src/widget.ts 变更 30 行。",
            suggestion: "请检查边界条件。",
            confidence: 0.78,
            blocking: true,
            status: "open"
          }
        ],
        createdAt,
        updatedAt
      },
      details: null
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
        summary: "Widget 评审摘要。",
        riskLevel: "medium",
        findings: [
          {
            id: "finding_123",
            taskId: "task_123",
            severity: "major",
            category: "bug",
            filePath: "src/widget.ts",
            title: "检查 widget 边界场景",
            evidence: "src/widget.ts 变更 30 行。",
            suggestion: "请检查边界条件。",
            confidence: 0.78,
            blocking: true,
            status: "open"
          }
        ]
      }
    });
  });

  it("maps persisted analysis details to the explainable API shape", () => {
    const generatedAt = new Date("2026-05-29T00:02:00.000Z");

    const details = mapAnalysisDetailsRecord({
      reviewContextSummary: {
        files: [
          {
            path: "src/widget.ts",
            contextSources: [
              {
                type: "file_content",
                filePath: "src/widget.ts",
                description: "PR head commit 上的仓库文件内容。"
              }
            ],
            contentAvailable: true,
            contentTruncated: false,
            isTestFile: false,
            testCandidatePaths: ["src/widget.test.ts"]
          }
        ],
        contextSources: [
          {
            type: "metadata",
            description: "来自 GitHub 的 Pull Request 元数据。"
          }
        ]
      },
      staticAnalysis: {
        signals: [
          {
            id: "src/widget.ts:console-log",
            filePath: "src/widget.ts",
            ruleId: "console-log",
            category: "maintainability",
            severity: "low",
            source: "introduced_by_pr",
            needsHumanConfirmation: false,
            message: "变更上下文中检测到 console.log 调试输出。",
            evidence: "console.log(value)",
            confidence: 0.62
          }
        ],
        skippedFiles: [],
        riskHints: ["低 console-log（src/widget.ts）：变更上下文中检测到 console.log 调试输出。"]
      },
      generatedAt
    });

    expect(details.generatedAt).toBe("2026-05-29T00:02:00.000Z");
    expect(details.reviewContextSummary.files[0]).toMatchObject({
      path: "src/widget.ts",
      contentAvailable: true,
      contentTruncated: false
    });
    expect(JSON.stringify(details)).not.toContain("const ");
  });
});
