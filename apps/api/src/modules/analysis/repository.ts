import {
  AnalysisDetails,
  AnalysisReport,
  AnalysisTask,
  ChangedFile,
  PullRequestSnapshot,
  ReviewContextSummary,
  StaticAnalysisResult,
  reviewFindingSchema
} from "@ai-pr-reviewer/core";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

type AnalysisTaskRecord = Prisma.AnalysisTaskGetPayload<{
  include: {
    snapshot: true;
    report: true;
    details: true;
  };
}>;

export interface AnalysisTaskRepository {
  saveTask(task: AnalysisTask): Promise<AnalysisTask>;
  findTask(taskId: string): Promise<AnalysisTask | null>;
  saveReport(taskId: string, report: AnalysisReport): Promise<AnalysisReport>;
  saveAnalysisDetails(taskId: string, details: AnalysisDetails): Promise<AnalysisDetails>;
  findAnalysisDetails(taskId: string): Promise<AnalysisDetails | null>;
}

const changedFileSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "removed", "renamed", "copied", "changed", "unchanged"]),
  additions: z.number().int(),
  deletions: z.number().int(),
  changes: z.number().int(),
  previousPath: z.string().optional(),
  patch: z.string().optional()
});

const changedFilesSchema = z.array(changedFileSchema);
const findingsSchema = z.array(reviewFindingSchema);
const analysisTaskStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
const contextSourceSchema = z.object({
  type: z.enum(["metadata", "patch", "file_content", "test_candidate"]),
  description: z.string(),
  filePath: z.string().optional()
});
const reviewContextSummarySchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    contextSources: z.array(contextSourceSchema),
    contentAvailable: z.boolean(),
    contentTruncated: z.boolean(),
    isTestFile: z.boolean(),
    testCandidatePaths: z.array(z.string())
  })),
  contextSources: z.array(contextSourceSchema)
});
const staticAnalysisSchema = z.object({
  signals: z.array(z.object({
    id: z.string(),
    filePath: z.string(),
    ruleId: z.string(),
    category: z.enum(["security", "maintainability", "test", "size"]),
    severity: z.enum(["low", "medium", "high"]),
    message: z.string(),
    evidence: z.string(),
    confidence: z.number(),
    line: z.number().optional()
  })),
  skippedFiles: z.array(z.object({
    filePath: z.string(),
    reason: z.enum(["generated", "lockfile", "build_artifact"])
  })),
  riskHints: z.array(z.string())
});

export class PrismaAnalysisTaskRepository implements AnalysisTaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveTask(task: AnalysisTask): Promise<AnalysisTask> {
    const createdAt = new Date(task.createdAt);
    const updatedAt = new Date(task.updatedAt);
    const create: Prisma.AnalysisTaskCreateInput = {
      id: task.taskId,
      repositoryOwner: task.repositoryOwner,
      repositoryName: task.repositoryName,
      pullRequestNumber: task.pullRequestNumber,
      status: task.status,
      errorMessage: task.errorMessage ?? null,
      createdAt,
      updatedAt,
      ...(task.snapshot ? { snapshot: { create: toSnapshotCreateInput(task.snapshot) } } : {}),
      ...(task.report ? { report: { create: toReportCreateInput(task.report) } } : {})
    };
    const update: Prisma.AnalysisTaskUpdateInput = {
      repositoryOwner: task.repositoryOwner,
      repositoryName: task.repositoryName,
      pullRequestNumber: task.pullRequestNumber,
      status: task.status,
      errorMessage: task.errorMessage ?? null,
      updatedAt,
      ...(task.snapshot
        ? {
            snapshot: {
              upsert: {
                create: toSnapshotCreateInput(task.snapshot),
                update: toSnapshotUpdateInput(task.snapshot)
              }
            }
          }
        : {}),
      ...(task.report
        ? {
            report: {
              upsert: {
                create: toReportCreateInput(task.report),
                update: toReportUpdateInput(task.report)
              }
            }
          }
        : {})
    };

    const record = await this.prisma.analysisTask.upsert({
      where: {
        id: task.taskId
      },
      create,
      update,
      include: {
        snapshot: true,
        report: true,
        details: true
      }
    });

    return mapAnalysisTaskRecord(record);
  }

  async findTask(taskId: string): Promise<AnalysisTask | null> {
    const record = await this.prisma.analysisTask.findUnique({
      where: {
        id: taskId
      },
      include: {
        snapshot: true,
        report: true,
        details: true
      }
    });

    return record ? mapAnalysisTaskRecord(record) : null;
  }

  async saveReport(taskId: string, report: AnalysisReport): Promise<AnalysisReport> {
    const record = await this.prisma.analysisReport.upsert({
      where: {
        taskId
      },
      create: {
        taskId,
        summary: report.summary,
        riskLevel: report.riskLevel,
        findings: stringifyJson(report.findings)
      },
      update: {
        summary: report.summary,
        riskLevel: report.riskLevel,
        findings: stringifyJson(report.findings)
      }
    });

    return mapAnalysisReportRecord(record);
  }

  async saveAnalysisDetails(taskId: string, details: AnalysisDetails): Promise<AnalysisDetails> {
    const record = await this.prisma.analysisDetails.upsert({
      where: {
        taskId
      },
      create: {
        taskId,
        reviewContextSummary: stringifyJson(details.reviewContextSummary),
        staticAnalysis: stringifyJson(details.staticAnalysis),
        generatedAt: new Date(details.generatedAt)
      },
      update: {
        reviewContextSummary: stringifyJson(details.reviewContextSummary),
        staticAnalysis: stringifyJson(details.staticAnalysis),
        generatedAt: new Date(details.generatedAt)
      }
    });

    return mapAnalysisDetailsRecord(record);
  }

  async findAnalysisDetails(taskId: string): Promise<AnalysisDetails | null> {
    const record = await this.prisma.analysisDetails.findUnique({
      where: {
        taskId
      }
    });

    return record ? mapAnalysisDetailsRecord(record) : null;
  }
}

export function mapAnalysisTaskRecord(record: AnalysisTaskRecord): AnalysisTask {
  const status = analysisTaskStatusSchema.parse(record.status);
  const snapshot = record.snapshot
    ? {
        id: record.snapshot.id,
        taskId: record.snapshot.taskId,
        repositoryOwner: record.snapshot.repositoryOwner,
        repositoryName: record.snapshot.repositoryName,
        pullRequestNumber: record.snapshot.pullRequestNumber,
        url: record.snapshot.url,
        title: record.snapshot.title,
        description: record.snapshot.description,
        author: record.snapshot.author,
        baseRef: record.snapshot.baseRef,
        baseSha: record.snapshot.baseSha,
        headRef: record.snapshot.headRef,
        commitSha: record.snapshot.commitSha,
        changedFiles: mapChangedFiles(record.snapshot.changedFiles)
      }
    : undefined;
  const report = record.report ? mapAnalysisReportRecord(record.report) : undefined;

  return {
    taskId: record.id,
    status,
    repositoryOwner: record.repositoryOwner,
    repositoryName: record.repositoryName,
    pullRequestNumber: record.pullRequestNumber,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...(snapshot ? { snapshot } : {}),
    ...(report ? { report } : {}),
    ...(record.errorMessage ? { errorMessage: record.errorMessage } : {})
  };
}

export function mapAnalysisReportRecord(record: {
  summary: string;
  riskLevel: string;
  findings: unknown;
}): AnalysisReport {
  return {
    summary: record.summary,
    riskLevel: z.enum(["low", "medium", "high", "unknown"]).parse(record.riskLevel),
    findings: findingsSchema.parse(parseJsonString(record.findings))
  };
}

export function mapAnalysisDetailsRecord(record: {
  reviewContextSummary: unknown;
  staticAnalysis: unknown;
  generatedAt: Date;
}): AnalysisDetails {
  return {
    reviewContextSummary: reviewContextSummarySchema.parse(parseJsonString(record.reviewContextSummary)) as ReviewContextSummary,
    staticAnalysis: staticAnalysisSchema.parse(parseJsonString(record.staticAnalysis)) as StaticAnalysisResult,
    generatedAt: record.generatedAt.toISOString()
  };
}

function toSnapshotCreateInput(snapshot: PullRequestSnapshot): Prisma.PullRequestSnapshotCreateWithoutTaskInput {
  return {
    id: snapshot.id,
    repositoryOwner: snapshot.repositoryOwner,
    repositoryName: snapshot.repositoryName,
    pullRequestNumber: snapshot.pullRequestNumber,
    url: snapshot.url,
    title: snapshot.title,
    description: snapshot.description,
    author: snapshot.author,
    baseRef: snapshot.baseRef,
    baseSha: snapshot.baseSha,
    headRef: snapshot.headRef,
    commitSha: snapshot.commitSha,
    changedFiles: stringifyJson(snapshot.changedFiles)
  };
}

function toSnapshotUpdateInput(snapshot: PullRequestSnapshot): Prisma.PullRequestSnapshotUpdateWithoutTaskInput {
  return {
    repositoryOwner: snapshot.repositoryOwner,
    repositoryName: snapshot.repositoryName,
    pullRequestNumber: snapshot.pullRequestNumber,
    url: snapshot.url,
    title: snapshot.title,
    description: snapshot.description,
    author: snapshot.author,
    baseRef: snapshot.baseRef,
    baseSha: snapshot.baseSha,
    headRef: snapshot.headRef,
    commitSha: snapshot.commitSha,
    changedFiles: stringifyJson(snapshot.changedFiles)
  };
}

function toReportCreateInput(report: AnalysisReport): Prisma.AnalysisReportCreateWithoutTaskInput {
  return {
    summary: report.summary,
    riskLevel: report.riskLevel,
    findings: stringifyJson(report.findings)
  };
}

function toReportUpdateInput(report: AnalysisReport): Prisma.AnalysisReportUpdateWithoutTaskInput {
  return {
    summary: report.summary,
    riskLevel: report.riskLevel,
    findings: stringifyJson(report.findings)
  };
}

function mapChangedFiles(value: unknown): ChangedFile[] {
  return changedFilesSchema.parse(parseJsonString(value)).map((file) => {
    const changedFile: ChangedFile = {
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    };

    if (file.previousPath !== undefined) {
      changedFile.previousPath = file.previousPath;
    }

    if (file.patch !== undefined) {
      changedFile.patch = file.patch;
    }

    return changedFile;
  });
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJsonString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return JSON.parse(value) as unknown;
}
