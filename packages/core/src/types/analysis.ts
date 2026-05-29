import { ReviewFinding } from "../schemas/review-finding";

export type AnalysisTaskStatus = "queued" | "running" | "completed" | "failed";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  previousPath?: string;
  patch?: string;
};

export type PullRequestSnapshot = {
  id: string;
  taskId: string;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: number;
  url: string;
  title: string;
  description: string;
  author: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  commitSha: string;
  changedFiles: ChangedFile[];
};

export type AnalysisTask = {
  taskId: string;
  status: AnalysisTaskStatus;
  repositoryOwner: string;
  repositoryName: string;
  pullRequestNumber: number;
  createdAt: string;
  updatedAt: string;
  snapshot?: PullRequestSnapshot;
  report?: AnalysisReport;
  errorMessage?: string;
};

export type AnalysisReport = {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  findings: ReviewFinding[];
};
