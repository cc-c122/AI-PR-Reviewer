import { PullRequestSnapshot } from "@ai-pr-reviewer/core";
import { describe, expect, it } from "vitest";
import { getPullRequestFileContents } from "./file-content";

describe("getPullRequestFileContents", () => {
  it("does not request content for removed files", async () => {
    const requestedPaths: string[] = [];
    const octokit = {
      rest: {
        repos: {
          async getContent(options: { path: string }) {
            requestedPaths.push(options.path);

            return {
              data: {
                type: "file",
                size: 12,
                content: Buffer.from("hello world").toString("base64")
              }
            };
          }
        }
      }
    };

    const contents = await getPullRequestFileContents(octokit as never, createSnapshot());

    expect(requestedPaths).toEqual(["src/kept.ts"]);
    expect(contents["src/kept.ts"]?.content).toBe("hello world");
    expect(contents["src/removed.ts"]).toBeUndefined();
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
    baseSha: "base123",
    headRef: "feature/widgets",
    commitSha: "head123",
    changedFiles: [
      {
        path: "src/removed.ts",
        status: "removed",
        additions: 0,
        deletions: 10,
        changes: 10
      },
      {
        path: "src/kept.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        changes: 2
      }
    ]
  };
}
