import {
  assessPullRequestRisk,
  buildPullRequestReviewContext,
  generatePullRequestSummary,
  PullRequestSnapshot
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
    expect(report.summary).toContain("Mock Review");
    expect(report.findings[0]?.title).toContain("边界场景");
    expect(report.findings[0]?.evidence).toContain("变更 30 行");
    expect(report.findings[0]?.suggestion).toContain("空值处理");
    expect(new Set(report.findings.map((finding) => finding.category))).toEqual(
      new Set(["bug", "test", "maintainability"]),
    );
  });

  it("uses static analysis line numbers for generated findings", async () => {
    const report = await generateMockReport({
      signals: [
        {
          id: "src/widget.ts:console-log",
          filePath: "src/widget.ts",
          ruleId: "console-log",
          category: "maintainability",
          severity: "low",
          message: "console.log detected.",
          evidence: "console.log(value)",
          confidence: 0.62,
          line: 42
        }
      ],
      skippedFiles: [],
      riskHints: []
    });

    expect(report.findings.find((finding) => finding.filePath === "src/widget.ts")?.line).toBe(42);
  });

  it("falls back to the first added changed line when no signal line exists", async () => {
    const report = await generateMockReport({
      signals: [],
      skippedFiles: [],
      riskHints: []
    });

    expect(report.findings.find((finding) => finding.filePath === "src/widget.ts")?.line).toBe(41);
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
      summary: "The PR changes widget behavior and needs focused review.",
      riskLevel: "medium",
      findings: [
        {
          id: "task_123:bug:widget",
          taskId: "task_123",
          severity: "major",
          category: "bug",
          filePath: "src/widget.ts",
          line: 41,
          title: "Validate widget edge cases",
          evidence: "src/widget.ts changed 30 line(s) in the provided snapshot.",
          suggestion: "Review boundary conditions around the changed widget behavior.",
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

async function generateMockReport(staticAnalysis: ReturnType<typeof createModelInput>["staticAnalysis"]) {
  const input = createModelInput();
  const client = new MockReviewModelClient();

  return client.generateReview({
    ...input,
    staticAnalysis
  });
}

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
        additions: 25,
        deletions: 5,
        changes: 30,
        patch: "@@ -40,0 +41,1 @@\n+console.log(value)"
      }
    ]
  };
}

function createModelInput() {
  const snapshot = createSnapshot();
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
