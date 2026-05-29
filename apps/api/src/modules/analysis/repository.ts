import {
  AnalysisReport,
  AnalysisTask,
  ChangedFile,
  PullRequestSnapshot,
  reviewFindingSchema
} from "@ai-pr-reviewer/core";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

type AnalysisTaskRecord = Prisma.AnalysisTaskGetPayload<{
  include: {
    snapshot: true;
    report: true;
  };
}>;

export interface AnalysisTaskRepository {
  saveTask(task: AnalysisTask): Promise<AnalysisTask>;
  findTask(taskId: string): Promise<AnalysisTask | null>;
  saveReport(taskId: string, report: AnalysisReport): Promise<AnalysisReport>;
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
        report: true
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
        report: true
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
