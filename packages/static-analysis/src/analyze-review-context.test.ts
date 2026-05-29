import { buildPullRequestReviewContext, PullRequestSnapshot } from "@ai-pr-reviewer/core";
import { describe, expect, it } from "vitest";
import { analyzeReviewContext } from "./analyze-review-context";

describe("analyzeReviewContext", () => {
  it("skips generated, lock, and build files", () => {
    const result = analyzeReviewContext(
      buildPullRequestReviewContext(createSnapshot([
        {
          path: "dist/app.min.js",
          status: "modified",
          additions: 1,
          deletions: 1,
          changes: 2,
          patch: "generated bundle"
        },
        {
          path: "pnpm-lock.yaml",
          status: "modified",
          additions: 1,
          deletions: 1,
          changes: 2,
          patch: "lockfile"
        }
      ])),
    );

    expect(result.skippedFiles).toEqual([
      { filePath: "dist/app.min.js", reason: "build_artifact" },
      { filePath: "pnpm-lock.yaml", reason: "lockfile" }
    ]);
    expect(result.riskHints).toContain("Skipped 2 generated/lock/build file(s) to reduce noise.");
  });

  it("detects security patterns", () => {
    const result = analyzeReviewContext(
      buildPullRequestReviewContext(
        createSnapshot([
          {
            path: "src/auth.ts",
            status: "modified",
            additions: 3,
            deletions: 0,
            changes: 3,
            patch: '+ const token = "super-secret-token";\n+ eval(userInput)\n+ element.innerHTML = value'
          }
        ]),
      ),
    );

    expect(result.signals.map((signal) => signal.ruleId)).toEqual(
      expect.arrayContaining(["hardcoded-secret", "eval-usage", "dangerous-html"]),
    );
  });

  it("emits missing test signal for source changes without test changes", () => {
    const result = analyzeReviewContext(
      buildPullRequestReviewContext(
        createSnapshot([
          {
            path: "src/foo.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            changes: 4,
            patch: "+ export const foo = 1"
          }
        ]),
      ),
    );

    expect(result.signals.find((signal) => signal.ruleId === "missing-test-change")).toMatchObject({
      filePath: "src/foo.ts",
      category: "test"
    });
  });
});

function createSnapshot(changedFiles: PullRequestSnapshot["changedFiles"]): PullRequestSnapshot {
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
    baseSha: "base123",
    headRef: "feature/widgets",
    commitSha: "head123",
    changedFiles
  };
}
