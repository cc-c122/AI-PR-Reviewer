import {
  assessPullRequestRisk,
  buildPullRequestReviewContext,
  generatePullRequestSummary,
  PullRequestSnapshot,
  StaticAnalysisResult
} from "@ai-pr-reviewer/core";
import { describe, expect, it } from "vitest";
import { MockReviewModelClient } from "./client";
import { createReviewModelClientFromEnv } from "./model-client-factory";
import { ModelOutputValidationError, OpenAICompatibleReviewModelClient } from "./providers/openai-compatible";
import { modelReviewOutputSchema } from "./validators/review-output";

describe("MockReviewModelClient", () => {
  it("returns schema-valid findings for bug, test, and maintainability", async () => {
    const snapshot = createSnapshot();
    const riskAssessment = assessPullRequestRisk(snapshot);
    const summary = generatePullRequestSummary(snapshot, riskAssessment);
    const reviewContext = buildPullRequestReviewContext(snapshot);
    const client = new MockReviewModelClient();

    const report = await client.generateReview({
      snapshot,
      riskAssessment,
      summary,
      reviewContext,
      staticAnalysis: {
        signals: [],
        skippedFiles: [],
        riskHints: []
      }
    });

    expect(() => modelReviewOutputSchema.parse(report)).not.toThrow();
    expect(report.riskLevel).toBe("medium");
    expect(report.summary).toContain("模拟评审");
    expect(report.findings[0]?.title).toContain("边界场景");
    expect(report.findings[0]?.evidence).toContain("变更 30 行");
    expect(report.findings[0]?.suggestion).toContain("空值处理");
    expect(new Set(report.findings.map((finding) => finding.category))).toEqual(
      new Set(["bug", "test", "maintainability"]),
    );
  });

  it("uses precise introduced security signal line numbers for bug findings", async () => {
    const report = await generateMockReport({
      signals: [
        {
          id: "src/widget.ts:hardcoded-secret",
          filePath: "src/widget.ts",
          ruleId: "hardcoded-secret",
          category: "security",
          severity: "high",
          source: "introduced_by_pr",
          needsHumanConfirmation: false,
          message: "可能存在硬编码 token。",
          evidence: "const token = \"super-secret-token\"",
          confidence: 0.74,
          line: 42
        }
      ],
      skippedFiles: [],
      riskHints: []
    });

    const finding = report.findings.find((item) => item.category === "security");

    expect(finding?.line).toBe(42);
    expect(finding?.title).toContain("安全风险");
  });

  it("uses precise introduced maintainability signal line numbers for maintainability findings", async () => {
    const report = await generateMockReport({
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
          confidence: 0.62,
          line: 42
        }
      ],
      skippedFiles: [],
      riskHints: []
    });

    expect(report.findings.find((finding) => finding.category === "maintainability")?.line).toBe(42);
  });

  it("does not reuse a default added line for file-level findings", async () => {
    const report = await generateMockReport({
      signals: [
        {
          id: "src/widget.ts:missing-test-change",
          filePath: "src/widget.ts",
          ruleId: "missing-test-change",
          category: "test",
          severity: "medium",
          source: "introduced_by_pr",
          needsHumanConfirmation: false,
          message: "本次 PR 修改了源代码，但没有检测到测试文件变更。",
          evidence: "候选相关测试：src/widget.test.ts。",
          confidence: 0.68,
          line: 41
        }
      ],
      skippedFiles: [],
      riskHints: []
    });

    expect(report.findings.find((finding) => finding.category === "bug")?.line).toBeUndefined();
    expect(report.findings.find((finding) => finding.category === "test")?.line).toBeUndefined();
    expect(report.findings.find((finding) => finding.category === "maintainability")?.line).toBeUndefined();
    expect(new Set(report.findings.map((finding) => finding.line).filter(Boolean)).size).toBe(0);
  });

  it("marks context-only static signal evidence as needing human confirmation", async () => {
    const report = await generateMockReport({
      signals: [
        {
          id: "src/widget.ts:context-many-any",
          filePath: "src/widget.ts",
          ruleId: "context-many-any",
          category: "maintainability",
          severity: "low",
          source: "context_only",
          needsHumanConfirmation: true,
          message: "相关文件上下文中存在较多 TypeScript any，需要人工确认是否与本 PR 相关。",
          evidence: "相关文件上下文中存在 6 个 any，需确认是否与本 PR 相关。",
          confidence: 0.35,
          line: 99
        }
      ],
      skippedFiles: [],
      riskHints: []
    });

    const finding = report.findings.find((item) => item.filePath === "src/widget.ts");

    expect(finding?.evidence).toContain("需要人工确认");
    expect(finding?.line).toBeUndefined();
    expect(finding?.blocking).toBe(false);
  });

  it("does not create a blocking bug finding when high-risk input only has context-only signals", async () => {
    const highRiskSnapshot = createSnapshot({
      changes: 900,
      additions: 850,
      patch: "@@ -40,0 +41,1 @@\n+export const value = 1"
    });
    const report = await generateMockReport(
      {
        signals: [
          {
            id: "src/widget.ts:hardcoded-secret",
            filePath: "src/widget.ts",
            ruleId: "hardcoded-secret",
            category: "security",
            severity: "medium",
            source: "context_only",
            needsHumanConfirmation: true,
            message: "相关上下文中可能存在硬编码密钥。",
            evidence: "仅在相关上下文中发现，无法确认由本 PR 引入，需要人工确认。",
            confidence: 0.45,
            line: 99
          }
        ],
        skippedFiles: [],
        riskHints: []
      },
      highRiskSnapshot,
    );

    const bugFinding = report.findings.find((finding) => finding.category === "bug");

    expect(report.riskLevel).toBe("high");
    expect(bugFinding?.blocking).toBe(false);
    expect(bugFinding?.line).toBeUndefined();
    expect(bugFinding?.evidence).toContain("仅上下文发现");
  });
});

describe("createReviewModelClientFromEnv", () => {
  it("uses the mock client when OPENAI_API_KEY is not set", () => {
    const client = createReviewModelClientFromEnv({});

    expect(client).toBeInstanceOf(MockReviewModelClient);
  });

  it("uses the OpenAI-compatible client when OPENAI_API_KEY is set", () => {
    const client = createReviewModelClientFromEnv({
      OPENAI_API_KEY: "test-key",
      OPENAI_MODEL: "review-model",
      OPENAI_BASE_URL: "https://models.example.test/v1"
    });

    expect(client).toBeInstanceOf(OpenAICompatibleReviewModelClient);
  });
});

describe("OpenAICompatibleReviewModelClient", () => {
  it("returns a schema-valid report from a valid model response", async () => {
    const input = createModelInput();
    const expectedReport = {
      summary: "该 PR 修改了 widget 行为，需要重点评审。",
      riskLevel: "medium",
      findings: [
        {
          id: "task_123:bug:widget",
          taskId: "task_123",
          severity: "major",
          category: "bug",
          filePath: "src/widget.ts",
          line: 41,
          title: "校验 widget 边界场景",
          evidence: "src/widget.ts 在快照中变更 30 行。",
          suggestion: "请检查 widget 行为变更周围的边界条件。",
          confidence: 0.75,
          blocking: true,
          status: "open"
        }
      ]
    };
    const client = new OpenAICompatibleReviewModelClient({
      apiKey: "test-key",
      model: "review-model",
      baseUrl: "https://models.example.test/v1/",
      fetch: async (url, init) => {
        expect(url).toBe("https://models.example.test/v1/chat/completions");
        expect(init.headers).toEqual({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json"
        });

        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(expectedReport)
              }
            }
          ]
        });
      }
    });

    await expect(client.generateReview(input)).resolves.toEqual(expectedReport);
  });

  it("drops model-provided finding lines that cannot be verified", async () => {
    const client = new OpenAICompatibleReviewModelClient({
      apiKey: "test-key",
      fetch: async () =>
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "该 PR 修改了 widget 行为。",
                  riskLevel: "medium",
                  findings: [
                    {
                      id: "task_123:bug:widget",
                      taskId: "task_123",
                      severity: "major",
                      category: "bug",
                      filePath: "src/widget.ts",
                      line: 999,
                      title: "检查 widget 边界场景",
                      evidence: "模型返回了无法验证的行号。",
                      suggestion: "应丢弃无法从上下文验证的行号。",
                      confidence: 0.75,
                      blocking: true,
                      status: "open"
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const report = await client.generateReview(createModelInput());

    expect(report.findings[0]?.line).toBeUndefined();
  });

  it("keeps model-provided finding lines that match changed lines or static signals", async () => {
    const input = createModelInput();

    input.staticAnalysis.signals = [
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
        confidence: 0.62,
        line: 42
      }
    ];

    const client = new OpenAICompatibleReviewModelClient({
      apiKey: "test-key",
      fetch: async () =>
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "该 PR 修改了 widget 行为。",
                  riskLevel: "medium",
                  findings: [
                    {
                      id: "task_123:maintainability:widget",
                      taskId: "task_123",
                      severity: "minor",
                      category: "maintainability",
                      filePath: "src/widget.ts",
                      line: 42,
                      title: "移除调试输出",
                      evidence: "静态分析信号 console-log 指向该新增行。",
                      suggestion: "合并前请移除调试日志。",
                      confidence: 0.7,
                      blocking: false,
                      status: "open"
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const report = await client.generateReview(input);

    expect(report.findings[0]?.line).toBe(42);
  });

  it("throws a clear error when model output fails schema validation", async () => {
    const client = new OpenAICompatibleReviewModelClient({
      apiKey: "test-key",
      fetch: async () =>
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Missing required fields.",
                  riskLevel: "severe",
                  findings: []
                })
              }
            }
          ]
        })
    });

    await expect(client.generateReview(createModelInput())).rejects.toThrow(ModelOutputValidationError);
    await expect(client.generateReview(createModelInput())).rejects.toThrow("failed schema validation");
  });
});

async function generateMockReport(staticAnalysis: StaticAnalysisResult, snapshot = createSnapshot()) {
  const input = createModelInput(snapshot);
  const client = new MockReviewModelClient();

  return client.generateReview({
    ...input,
    staticAnalysis
  });
}

function createSnapshot(overrides: Partial<PullRequestSnapshot["changedFiles"][number]> = {}): PullRequestSnapshot {
  const changedFile: PullRequestSnapshot["changedFiles"][number] = {
    path: "src/widget.ts",
    status: "modified",
    additions: 25,
    deletions: 5,
    changes: 30,
    patch: "@@ -40,0 +41,1 @@\n+console.log(value)",
    ...overrides
  };

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
    changedFiles: [changedFile]
  };
}

function createModelInput(snapshot = createSnapshot()) {
  const riskAssessment = assessPullRequestRisk(snapshot);
  const summary = generatePullRequestSummary(snapshot, riskAssessment);
  const reviewContext = buildPullRequestReviewContext(snapshot);

  return {
    snapshot,
    riskAssessment,
    summary,
    reviewContext,
    staticAnalysis: {
      signals: [],
      skippedFiles: [],
      riskHints: []
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
