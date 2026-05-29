import {
  AnalysisModelClient,
  AnalysisDetails,
  AnalysisReportWithDetails,
  AnalysisTask,
  CreateAnalysisTaskInput,
  PullRequestReviewContext,
  ReviewContextFileContents,
  StaticAnalysisResult,
  buildAnalysisDetails,
  buildPullRequestReviewContext,
  createPullRequestAnalysisTask,
  generateAnalysisReport
} from "@ai-pr-reviewer/core";
import { getPullRequestFileContents, getPullRequestSnapshot, GitHubClient } from "@ai-pr-reviewer/github";
import { analyzeReviewContext } from "@ai-pr-reviewer/static-analysis";
import { nanoid } from "nanoid";
import { AnalysisTaskRepository } from "./repository";

export type AnalysisServiceOptions = {
  repository: AnalysisTaskRepository;
  githubClient: GitHubClient;
  reviewModelClient: AnalysisModelClient;
  fetchFileContents?: (task: AnalysisTask) => Promise<ReviewContextFileContents>;
};

export class AnalysisService {
  private readonly reviewContextByTaskId = new Map<string, PullRequestReviewContext>();

  constructor(private readonly options: AnalysisServiceOptions) {}

  async createTask(input: CreateAnalysisTaskInput): Promise<AnalysisTask> {
    const task = await createPullRequestAnalysisTask({
      input,
      generateTaskId: nanoid,
      fetchPullRequestSnapshot: (reference, taskId) =>
        getPullRequestSnapshot(this.options.githubClient, reference, taskId)
    });

    let reviewContext: PullRequestReviewContext | undefined;

    if (task.snapshot) {
      const fileContents = await this.fetchFileContentsSafely(task);
      reviewContext = buildPullRequestReviewContext(task.snapshot, fileContents);
      this.reviewContextByTaskId.set(task.taskId, reviewContext);
    }

    const savedTask = await this.options.repository.saveTask(task);

    if (reviewContext) {
      await this.saveAnalysisDetails(task.taskId, reviewContext, analyzeReviewContext(reviewContext));
    }

    return savedTask;
  }

  async getTask(taskId: string): Promise<AnalysisTask | null> {
    return this.options.repository.findTask(taskId);
  }

  async getReport(taskId: string): Promise<AnalysisReportWithDetails | null> {
    const task = await this.options.repository.findTask(taskId);

    if (!task) {
      return null;
    }

    if (task.report) {
      return {
        ...task.report,
        details: await this.getOrCreateAnalysisDetails(task)
      };
    }

    if (!task.snapshot) {
      throw new PullRequestSnapshotUnavailableError(taskId);
    }

    const reviewContext = this.reviewContextByTaskId.get(taskId) ?? buildPullRequestReviewContext(task.snapshot);
    const staticAnalysis = analyzeReviewContext(reviewContext);
    const details = await this.saveAnalysisDetails(taskId, reviewContext, staticAnalysis);
    const report = await generateAnalysisReport(
      task.snapshot,
      this.options.reviewModelClient,
      reviewContext,
      staticAnalysis,
    );
    const savedReport = await this.options.repository.saveReport(taskId, report);

    return {
      ...savedReport,
      details
    };
  }

  private async getOrCreateAnalysisDetails(task: AnalysisTask): Promise<AnalysisDetails> {
    const persistedDetails = await this.options.repository.findAnalysisDetails(task.taskId);

    if (persistedDetails) {
      return persistedDetails;
    }

    if (!task.snapshot) {
      throw new PullRequestSnapshotUnavailableError(task.taskId);
    }

    const reviewContext = this.reviewContextByTaskId.get(task.taskId) ?? buildPullRequestReviewContext(task.snapshot);
    const staticAnalysis = analyzeReviewContext(reviewContext);

    return this.saveAnalysisDetails(task.taskId, reviewContext, staticAnalysis);
  }

  private async saveAnalysisDetails(
    taskId: string,
    reviewContext: PullRequestReviewContext,
    staticAnalysis: StaticAnalysisResult,
  ): Promise<AnalysisDetails> {
    return this.options.repository.saveAnalysisDetails(
      taskId,
      buildAnalysisDetails(reviewContext, staticAnalysis),
    );
  }

  private async fetchFileContentsSafely(task: AnalysisTask): Promise<ReviewContextFileContents> {
    if (!task.snapshot) {
      return {};
    }

    try {
      return this.options.fetchFileContents
        ? await this.options.fetchFileContents(task)
        : await getPullRequestFileContents(this.options.githubClient, task.snapshot);
    } catch {
      return {};
    }
  }
}

export class PullRequestSnapshotUnavailableError extends Error {
  constructor(readonly taskId: string) {
    super(`Pull request snapshot is not available for analysis task ${taskId}.`);
    this.name = "PullRequestSnapshotUnavailableError";
  }
}
