import { describe, expect, it } from "vitest";
import { parseGitHubPullRequestUrl } from "./pull-request-url";

describe("parseGitHubPullRequestUrl", () => {
  it("parses a GitHub pull request URL", () => {
    expect(parseGitHubPullRequestUrl("https://github.com/openai/codex/pull/123")).toEqual({
      owner: "openai",
      repo: "codex",
      pullNumber: 123
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(() => parseGitHubPullRequestUrl("https://example.com/openai/codex/pull/123")).toThrow(
      "Only github.com pull request URLs are supported.",
    );
  });

  it("rejects non-pull-request GitHub URLs", () => {
    expect(() => parseGitHubPullRequestUrl("https://github.com/openai/codex/issues/123")).toThrow(
      "Invalid GitHub pull request URL.",
    );
  });

  it("rejects pull request URLs with extra path segments", () => {
    expect(() =>
      parseGitHubPullRequestUrl("https://github.com/openai/codex/pull/123/files"),
    ).toThrow("Invalid GitHub pull request URL.");
  });

  it("rejects non-numeric pull request numbers", () => {
    expect(() => parseGitHubPullRequestUrl("https://github.com/openai/codex/pull/abc")).toThrow(
      "Invalid GitHub pull request number.",
    );
  });
});
