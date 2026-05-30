import {
  AnalysisModelClient,
  AnalysisModelInput,
  AnalysisReport,
  ChangedFile,
  ReviewFinding,
  reviewFindingSchema
} from "@ai-pr-reviewer/core";
import { modelReviewOutputSchema } from "./validators/review-output";

export type ReviewModelInput = AnalysisModelInput;

export type ReviewModelClient = AnalysisModelClient;

export class MockReviewModelClient implements ReviewModelClient {
  async generateReview(input: ReviewModelInput): Promise<AnalysisReport> {
    const findings = [
      createBugFinding(input),
      createTestFinding(input),
      createMaintainabilityFinding(input)
    ].map((finding) => reviewFindingSchema.parse(finding));

    return modelReviewOutputSchema.parse({
      summary: `Mock Review：${input.summary}`,
      riskLevel: input.riskAssessment.riskLevel,
      findings
    });
  }
}

function createBugFinding(input: ReviewModelInput): ReviewFinding {
  const contextFile =
    input.reviewContext.changedFiles.find((file) => !file.isTestFile && isSourcePath(file.path)) ??
    input.reviewContext.changedFiles[0];
  const file = input.snapshot.changedFiles.find((changedFile) => changedFile.path === contextFile?.path) ?? input.snapshot.changedFiles[0];
  const evidenceDetail = contextFile
    ? describeContextAvailability(contextFile)
    : "Review 上下文中没有变更文件。";
  const staticSignalEvidence = describeStaticSignals(input, file?.path);
  const line = findSuggestedLine(input, file?.path);

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:bug:${toFindingId(file?.path ?? "pull-request")}`,
    taskId: input.snapshot.taskId,
    severity: input.riskAssessment.riskLevel === "high" ? "major" : "minor",
    category: "bug",
    filePath: file?.path ?? "pull-request",
    ...(line !== undefined ? { line } : {}),
    title: "检查变更逻辑的边界场景",
    evidence: file
      ? `${file.path} 变更 ${file.changes} 行，可能影响运行时行为。${evidenceDetail}${staticSignalEvidence}`
      : "PR 快照中没有变更文件。",
    suggestion: "请人工确认变更逻辑周围的边界条件、空值处理和失败路径。",
    confidence: file ? 0.58 : 0.35,
    blocking: input.riskAssessment.riskLevel === "high",
    status: "open"
  });
}

function createTestFinding(input: ReviewModelInput): ReviewFinding {
  const sourceFile = findFirstSourceFile(input.snapshot.changedFiles);
  const filePath = sourceFile?.path ?? input.snapshot.changedFiles[0]?.path ?? "pull-request";
  const contextFile = input.reviewContext.changedFiles.find((file) => file.path === filePath);
  const missingTestSignal = input.staticAnalysis.signals.find(
    (signal) => signal.ruleId === "missing-test-change" && signal.filePath === filePath,
  );
  const hasTestChanges = input.riskAssessment.testFileCount > 0;
  const line = findSuggestedLine(input, filePath);

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:test:${toFindingId(filePath)}`,
    taskId: input.snapshot.taskId,
    severity: hasTestChanges ? "info" : "major",
    category: "test",
    filePath,
    ...(line !== undefined ? { line } : {}),
    title: hasTestChanges ? "确认测试覆盖与行为变更匹配" : "为变更行为新增或更新测试",
    evidence: hasTestChanges
      ? `本次 PR 变更了 ${input.riskAssessment.testFileCount} 个测试文件。`
      : missingTestSignal
        ? `静态分析信号 ${missingTestSignal.ruleId}: ${missingTestSignal.evidence}`
        : contextFile && contextFile.testCandidatePaths.length > 0
          ? `未检测到测试文件变更。候选相关测试包括 ${contextFile.testCandidatePaths.slice(0, 3).join(", ")}。`
          : "源代码变更旁未检测到测试文件变更。",
    suggestion: hasTestChanges
      ? "请确认更新后的测试同时覆盖预期行为和相关失败路径。"
      : "合并前请补充聚焦测试，覆盖本次 PR 修改的行为。",
    confidence: hasTestChanges ? 0.55 : 0.72,
    blocking: !hasTestChanges && input.riskAssessment.riskLevel !== "low",
    status: "open"
  });
}

function createMaintainabilityFinding(input: ReviewModelInput): ReviewFinding {
  const file = findLargestFile(input.snapshot.changedFiles);
  const line = findSuggestedLine(input, file?.path);

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:maintainability:${toFindingId(file?.path ?? "pull-request")}`,
    taskId: input.snapshot.taskId,
    severity: file && file.changes >= 300 ? "major" : "minor",
    category: "maintainability",
    filePath: file?.path ?? "pull-request",
    ...(line !== undefined ? { line } : {}),
    title: "优先关注最大变更区域",
    evidence: file
      ? `${file.path} 是本次改动最大的文件，共 ${file.changes} 行变更。`
      : "快照中没有可用于排序的变更文件。",
    suggestion: "如果该文件混合了无关职责，建议将后续工作拆分到清晰边界中。",
    confidence: file ? 0.64 : 0.35,
    blocking: false,
    status: "open"
  });
}

function findFirstSourceFile(files: ChangedFile[]): ChangedFile | undefined {
  return files.find((file) => !isTestPath(file.path) && isSourcePath(file.path));
}

function findLargestFile(files: ChangedFile[]): ChangedFile | undefined {
  return [...files].sort((left, right) => right.changes - left.changes)[0];
}

function isTestPath(path: string): boolean {
  return /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/iu.test(path);
}

function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs)$/iu.test(path);
}

function describeContextAvailability(file: {
  patch?: string;
  content?: string;
  contentTruncated?: boolean;
}): string {
  const sources = [];

  if (file.patch) {
    sources.push("patch 可用");
  }

  if (file.content) {
    sources.push(file.contentTruncated ? "截断后的文件内容可用" : "文件内容可用");
  }

  return sources.length > 0 ? `Review 上下文：${sources.join("；")}。` : "Review 上下文仅包含文件元数据。";
}

function describeStaticSignals(input: ReviewModelInput, filePath: string | undefined): string {
  if (!filePath) {
    return "";
  }

  const signals = input.staticAnalysis.signals.filter((signal) => signal.filePath === filePath).slice(0, 2);

  if (signals.length === 0) {
    return "";
  }

  return ` 静态分析信号：${signals.map((signal) => `${signal.ruleId}（${signal.severity}，${signal.confidence}）`).join("；")}。`;
}

function findSuggestedLine(input: ReviewModelInput, filePath: string | undefined): number | undefined {
  if (!filePath) {
    return undefined;
  }

  const signalLine = input.staticAnalysis.signals.find((signal) => signal.filePath === filePath && signal.line)?.line;

  if (signalLine !== undefined) {
    return signalLine;
  }

  return input.reviewContext.changedFiles
    .find((file) => file.path === filePath)
    ?.changedLines
    ?.find((line) => line.type === "added")
    ?.line;
}

function toFindingId(value: string): string {
  return value.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase() || "pull-request";
}
