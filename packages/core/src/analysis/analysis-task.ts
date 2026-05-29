import { z } from "zod";
import { parseGitHubPullRequestUrl, PullRequestReference } from "./pull-request-url";
import { AnalysisTask, PullRequestSnapshot } from "../types/analysis";

export const createAnalysisTaskInputSchema = z.object({
  pullRequestUrl: z.string().url()
});

export type CreateAnalysisTaskInput = z.infer<typeof createAnalysisTaskInputSchema>;

export type PullRequestSnapshotFetcher = (
  reference: PullRequestReference,
  taskId: string,
) => Promise<PullRequestSnapshot>;

export type CreatePullRequestAnalysisTaskOptions = {
  input: CreateAnalysisTaskInput;
  fetchPullRequestSnapshot: PullRequestSnapshotFetcher;
  generateTaskId: () => string;
  now?: () => Date;
};

export async function createPullRequestAnalysisTask(
  options: CreatePullRequestAnalysisTaskOptions,
): Promise<AnalysisTask> {
  const input = createAnalysisTaskInputSchema.parse(options.input);
  const reference = parseGitHubPullRequestUrl(input.pullRequestUrl);
  const taskId = options.generateTaskId();
  const timestamp = (options.now ?? (() => new Date()))().toISOString();

  const snapshot = await options.fetchPullRequestSnapshot(reference, taskId);

  return {
    taskId,
    status: "completed",
    repositoryOwner: reference.owner,
    repositoryName: reference.repo,
    pullRequestNumber: reference.pullNumber,
    createdAt: timestamp,
    updatedAt: timestamp,
    snapshot
  };
}
