import { describe, expect, it } from "vitest";
import { adaptGitHubChangedFile, adaptGitHubPullRequest } from "./pull-request";

describe("GitHub pull request adapters", () => {
  it("adapts GitHub changed files into core changed files", () => {
    const file = {
      filename: "src/new-name.ts",
      status: "renamed",
      additions: 12,
      deletions: 3,
      changes: 15,
      previous_filename: "src/old-name.ts",
      patch: "@@ -1 +1 @@"
    } as unknown as Parameters<typeof adaptGitHubChangedFile>[0];

    expect(adaptGitHubChangedFile(file)).toEqual({
      path: "src/new-name.ts",
      status: "renamed",
      additions: 12,
      deletions: 3,
      changes: 15,
      previousPath: "src/old-name.ts",
      patch: "@@ -1 +1 @@"
    });
  });

  it("adapts GitHub PR metadata into a core snapshot", () => {
    const pullRequest = {
      id: 42,
      html_url: "https://github.com/acme/widgets/pull/7",
      title: "Improve widget rendering",
      body: "Adds a safer rendering path.",
      user: {
        login: "octocat"
      },
      base: {
        ref: "main",
        sha: "base-sha"
      },
      head: {
        ref: "feature/widgets",
        sha: "head-sha"
      }
    } as unknown as Parameters<typeof adaptGitHubPullRequest>[0];

    const changedFiles = [
      {
        path: "src/widget.ts",
        status: "modified" as const,
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: "@@ -1 +1 @@"
      }
    ];

    expect(
      adaptGitHubPullRequest(
        pullRequest,
        { owner: "acme", repo: "widgets", pullNumber: 7 },
        "task_123",
        changedFiles,
      ),
    ).toEqual({
      id: "42",
      taskId: "task_123",
      repositoryOwner: "acme",
      repositoryName: "widgets",
      pullRequestNumber: 7,
      url: "https://github.com/acme/widgets/pull/7",
      title: "Improve widget rendering",
      description: "Adds a safer rendering path.",
      author: "octocat",
      baseRef: "main",
      baseSha: "base-sha",
      headRef: "feature/widgets",
      commitSha: "head-sha",
      changedFiles
    });
  });
});
