import { describe, expect, it } from "vitest";
import { AnalysisReport, AnalysisTask, ReviewFinding } from "./api-client";
import { formatFindingComment, formatReviewSummary } from "./review-comments";

describe("review comment formatting", () => {
  it("formats a finding as a GitHub review comment draft", () => {
    expect(formatFindingComment(createFinding())).toContain("### 检查空值处理");
    expect(formatFindingComment(createFinding())).toContain("**严重程度 / 类型:** 主要 / 缺陷");
    expect(formatFindingComment(createFinding())).toContain("**位置:** `src/widget.ts:42`");
    expect(formatFindingComment(createFinding())).toContain("**置信度:** 82%");
    expect(formatFindingComment(createFinding())).toContain("**是否阻塞:** 是");
    expect(formatFindingComment(createFinding())).toContain("请检查边界条件。");
  });

  it("formats a full review summary with findings", () => {
    const report: AnalysisReport = {
      summary: "这个 PR 调整了 widget 行为。",
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

    expect(summary).toContain("AI PR 评审摘要：acme/widgets#7");
    expect(summary).toContain("https://github.com/acme/widgets/pull/7");
    expect(summary).toContain("阻塞问题:** 1");
    expect(summary).toContain("[主要/缺陷/阻塞] src/widget.ts: 检查空值处理");
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
    title: "检查空值处理",
    evidence: "变更路径读取 profile.id 前没有检查 profile。",
    suggestion: "请检查边界条件。",
    confidence: 0.82,
    blocking: true,
    status: "open"
  };
}
