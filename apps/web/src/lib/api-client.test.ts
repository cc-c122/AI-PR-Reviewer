import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnalysisTask } from "./api-client";
import { demoPullRequestUrl } from "./demo-pr";

describe("Demo PR analysis entry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the long-lived repository demo pull request URL", () => {
    expect(demoPullRequestUrl).toBe("https://github.com/cc-c122/AI-PR-Reviewer/pull/1");
    expect(demoPullRequestUrl).not.toContain("org/repo/pull/123");
  });

  it("returns a mock report in demo mode for the demo pull request", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");

    const task = await createAnalysisTask(demoPullRequestUrl);

    expect(task.taskId).toBe("demo-cc-c122-AI-PR-Reviewer-1");
    expect(task.status).toBe("completed");
    expect(task.repositoryOwner).toBe("cc-c122");
    expect(task.repositoryName).toBe("AI-PR-Reviewer");
    expect(task.pullRequestNumber).toBe(1);
    expect(task.report?.summary).toContain("这是 Demo 报告");
  });

  it("posts the demo pull request URL to the API outside demo mode", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(createTaskResponse()), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await createAnalysisTask(demoPullRequestUrl);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis-tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pullRequestUrl: demoPullRequestUrl })
      }),
    );
  });
});

function createTaskResponse() {
  return {
    taskId: "task_123",
    status: "queued",
    repositoryOwner: "cc-c122",
    repositoryName: "AI-PR-Reviewer",
    pullRequestNumber: 1,
    createdAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z"
  };
}
