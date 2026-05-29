import {
  AnalysisModelClient,
  AnalysisReport,
  AnalysisTask,
  CreateAnalysisTaskInput,
  createPullRequestAnalysisTask,
  generateAnalysisReport
} from "@ai-pr-reviewer/core";
import { getPullRequestSnapshot, GitHubClient } from "@ai-pr-reviewer/github";
import { nanoid } from "nanoid";
import { AnalysisTaskRepository } from "./repository";

export type AnalysisServiceOptions = {
  repository: AnalysisTaskRepository;
  githubClient: GitHubClient;
  reviewModelClient: AnalysisModelClient;
};

export class AnalysisService {
  constructor(private readonly options: AnalysisServiceOptions) {}

  async createTask(input: CreateAnalysisTaskInput): Promise<AnalysisTask> {
    const task = await createPullRequestAnalysisTask({
      input,
      generateTaskId: nanoid,
      fetchPullRequestSnapshot: (reference, taskId) =>
        getPullRequestSnapshot(this.options.githubClient, reference, taskId)
    });

    return this.options.repository.saveTask(task);
  }

  async getTask(taskId: string): Promise<AnalysisTask | null> {
    return this.options.repository.findTask(taskId);
  }

  async getReport(taskId: string): Promise<AnalysisReport | null> {
    const task = await this.options.repository.findTask(taskId);

    if (!task) {
      return null;
    }

    if (task.report) {
      return task.report;
    }

    if (!task.snapshot) {
      throw new PullRequestSnapshotUnavailableError(taskId);
    }

    const report = await generateAnalysisReport(task.snapshot, this.options.reviewModelClient);

    return this.options.repository.saveReport(taskId, report);
  }
}

export class PullRequestSnapshotUnavailableError extends Error {
  constructor(readonly taskId: string) {
    super(`Pull request snapshot is not available for analysis task ${taskId}.`);
    this.name = "PullRequestSnapshotUnavailableError";
  }
}
