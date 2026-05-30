import { describe, expect, it } from "vitest";
import { buildAnalysisDetails, generateAnalysisReport } from "./report";
import { PullRequestSnapshot } from "../types/analysis";

describe("generateAnalysisReport", () => {
  it("builds model input from a pull request snapshot", async () => {
    const snapshot = createSnapshot();
    const report = await generateAnalysisReport(snapshot, {
      async generateReview(input) {
        expect(input.snapshot).toBe(snapshot);
        expect(input.summary).toContain("acme/widgets#7");
        expect(input.riskAssessment.riskLevel).toBe("medium");
        expect(input.reviewContext.pullRequest.title).toBe("Improve widgets");
        expect(input.reviewContext.changedFiles[0]?.path).toBe("src/widget.ts");
        expect(input.staticAnalysis.signals).toEqual([]);

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

  it("passes static analysis into model input", async () => {
    const snapshot = createSnapshot();
    const staticAnalysis = {
      signals: [
        {
          id: "src/widget.ts:console-log",
          filePath: "src/widget.ts",
          ruleId: "console-log",
          category: "maintainability" as const,
          severity: "low" as const,
          source: "introduced_by_pr" as const,
          needsHumanConfirmation: false,
          message: "变更上下文中检测到 console.log 调试输出。",
          evidence: "console.log(value)",
          confidence: 0.62
        }
      ],
      skippedFiles: [],
      riskHints: ["低 console-log（src/widget.ts）：变更上下文中检测到 console.log 调试输出。"]
    };

    await generateAnalysisReport(
      snapshot,
      {
        async generateReview(input) {
          expect(input.staticAnalysis).toBe(staticAnalysis);

          return {
            summary: input.summary,
            riskLevel: input.riskAssessment.riskLevel,
            findings: []
          };
        }
      },
      undefined,
      staticAnalysis,
    );
  });

  it("does not let context-only static analysis raise the core risk assessment", async () => {
    const snapshot = createSnapshot();
    const staticAnalysis = {
      signals: [
        {
          id: "src/widget.ts:hardcoded-secret",
          filePath: "src/widget.ts",
          ruleId: "hardcoded-secret",
          category: "security" as const,
          severity: "medium" as const,
          source: "context_only" as const,
          needsHumanConfirmation: true,
          message: "相关上下文中可能存在硬编码密钥。",
          evidence: "仅在相关上下文中发现，无法确认由本 PR 引入，需要人工确认。",
          confidence: 0.45
        }
      ],
      skippedFiles: [],
      riskHints: [
        "中 [仅上下文发现 / 需要人工确认] hardcoded-secret（src/widget.ts）：相关上下文中可能存在硬编码密钥。"
      ]
    };

    await generateAnalysisReport(
      snapshot,
      {
        async generateReview(input) {
          expect(input.riskAssessment.riskLevel).toBe("medium");
          expect(input.staticAnalysis).toBe(staticAnalysis);

          return {
            summary: input.summary,
            riskLevel: input.riskAssessment.riskLevel,
            findings: []
          };
        }
      },
      undefined,
      staticAnalysis,
    );
  });

  it("builds explainable details without persisting full file content", () => {
    const snapshot = createSnapshot();
    const details = buildAnalysisDetails(
      {
        pullRequest: {
          taskId: snapshot.taskId,
          repositoryOwner: snapshot.repositoryOwner,
          repositoryName: snapshot.repositoryName,
          pullRequestNumber: snapshot.pullRequestNumber,
          url: snapshot.url,
          title: snapshot.title,
          description: snapshot.description,
          author: snapshot.author,
          baseRef: snapshot.baseRef,
          headRef: snapshot.headRef,
          commitSha: snapshot.commitSha
        },
        changedFiles: [
          {
            path: "src/widget.ts",
            status: "modified",
            additions: 30,
            deletions: 10,
            changes: 40,
            patch: "@@ patch should not be persisted in details @@",
            content: "const secret = 'full source content should stay transient';",
            contentTruncated: true,
            isTestFile: false,
            testCandidatePaths: ["src/widget.test.ts"],
            contextSources: [
              {
                type: "file_content",
                filePath: "src/widget.ts",
                description: "PR head commit 上的仓库文件内容，因大小限制已截断。"
              }
            ]
          }
        ],
        contextSources: [
          {
            type: "metadata",
            description: "来自 GitHub 的 Pull Request 元数据。"
          }
        ]
      },
      {
        signals: [
          {
            id: "src/widget.ts:hardcoded-secret",
            filePath: "src/widget.ts",
            ruleId: "hardcoded-secret",
            category: "security",
            severity: "high",
            source: "introduced_by_pr",
            needsHumanConfirmation: false,
            message: "可能存在硬编码 token、password、secret 或 API key。",
            evidence: "const token = \"super-secret-value\";",
            confidence: 0.74
          }
        ],
        skippedFiles: [],
        riskHints: []
      },
      "2026-05-29T00:00:00.000Z",
    );

    expect(details.reviewContextSummary.files[0]).toEqual({
      path: "src/widget.ts",
      contextSources: [
        {
          type: "file_content",
          filePath: "src/widget.ts",
          description: "PR head commit 上的仓库文件内容，因大小限制已截断。"
        }
      ],
      contentAvailable: true,
      contentTruncated: true,
      isTestFile: false,
      testCandidatePaths: ["src/widget.test.ts"]
    });
    expect(JSON.stringify(details)).not.toContain("full source content");
    expect(JSON.stringify(details)).not.toContain("@@ patch should not be persisted");
    expect(JSON.stringify(details)).not.toContain("super-secret-value");
    expect(details.staticAnalysis.signals[0]?.evidence).toContain("[REDACTED]");
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
