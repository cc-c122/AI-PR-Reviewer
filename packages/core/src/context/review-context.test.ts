import { describe, expect, it } from "vitest";
import { buildPullRequestReviewContext, getTestCandidatePaths } from "./review-context";
import { PullRequestSnapshot } from "../types/analysis";

describe("getTestCandidatePaths", () => {
  it("infers colocated and tests directory candidates for source files", () => {
    expect(getTestCandidatePaths("src/foo.ts")).toEqual([
      "src/foo.test.ts",
      "src/foo.spec.ts",
      "src/__tests__/foo.test.ts",
      "tests/foo.test.ts",
      "tests/foo.spec.ts"
    ]);
  });

  it("returns the path itself when the changed file is a test file", () => {
    expect(getTestCandidatePaths("src/foo.spec.ts")).toEqual(["src/foo.spec.ts"]);
  });
});

describe("buildPullRequestReviewContext", () => {
  it("includes metadata, patch, file content, and test candidate context sources", () => {
    const context = buildPullRequestReviewContext(createSnapshot(), {
      "src/foo.ts": {
        content: "export function foo() { return 1; }",
        truncated: false
      }
    });

    expect(context.pullRequest).toMatchObject({
      title: "Improve foo",
      author: "octocat",
      baseRef: "main",
      headRef: "feature/foo",
      commitSha: "abc123"
    });
    expect(context.changedFiles[0]).toMatchObject({
      path: "src/foo.ts",
        patch: "@@ -1 +1,2 @@\n export const oldFoo = 1;\n+export const foo = 1;",
        changedLines: [
          { line: 1, content: "export const oldFoo = 1;", type: "context" },
          { line: 2, content: "export const foo = 1;", type: "added" }
        ],
      content: "export function foo() { return 1; }",
      contentTruncated: false,
      testCandidatePaths: [
        "src/foo.test.ts",
        "src/foo.spec.ts",
        "src/__tests__/foo.test.ts",
        "tests/foo.test.ts",
        "tests/foo.spec.ts"
      ]
    });
    expect(context.contextSources.map((source) => source.type)).toEqual([
      "metadata",
      "metadata",
      "patch",
      "file_content",
      "test_candidate"
    ]);
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
    title: "Improve foo",
    description: "Improves foo behavior.",
    author: "octocat",
    baseRef: "main",
    baseSha: "base123",
    headRef: "feature/foo",
    commitSha: "abc123",
    changedFiles: [
      {
        path: "src/foo.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: "@@ -1 +1,2 @@\n export const oldFoo = 1;\n+export const foo = 1;"
      }
    ]
  };
}
