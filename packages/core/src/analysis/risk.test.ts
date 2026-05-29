import { describe, expect, it } from "vitest";
import { assessPullRequestRisk } from "./risk";
import { PullRequestSnapshot } from "../types/analysis";

describe("assessPullRequestRisk", () => {
  it("marks empty snapshots as unknown risk", () => {
    expect(assessPullRequestRisk(createSnapshot([])).riskLevel).toBe("unknown");
  });

  it("marks a small source-only change without tests as medium risk", () => {
    const assessment = assessPullRequestRisk(
      createSnapshot([
        {
          path: "src/service.ts",
          status: "modified",
          additions: 8,
          deletions: 2,
          changes: 10
        }
      ]),
    );

    expect(assessment.riskLevel).toBe("medium");
    expect(assessment.testFileCount).toBe(0);
  });

  it("marks large and broad changes as high risk", () => {
    const assessment = assessPullRequestRisk(
      createSnapshot([
        {
          path: "src/service.ts",
          status: "modified",
          additions: 450,
          deletions: 400,
          changes: 850
        }
      ]),
    );

    expect(assessment.riskLevel).toBe("high");
    expect(assessment.totalChanges).toBe(850);
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
    baseSha: "base-sha",
    headRef: "feature/widgets",
    commitSha: "head-sha",
    changedFiles
  };
}
