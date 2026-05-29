import {
  AnalysisModelClient,
  AnalysisModelInput,
  AnalysisReport,
  ChangedFile,
  reviewFindingSchema,
  ReviewFinding
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
      summary: input.summary,
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
    : "The pull request has no changed files in the review context.";
  const staticSignalEvidence = describeStaticSignals(input, file?.path);

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:bug:${toFindingId(file?.path ?? "pull-request")}`,
    taskId: input.snapshot.taskId,
    severity: input.riskAssessment.riskLevel === "high" ? "major" : "minor",
    category: "bug",
    filePath: file?.path ?? "pull-request",
    title: "Review changed logic for edge cases",
    evidence: file
      ? `${file.path} changed ${file.changes} line(s), which may affect runtime behavior. ${evidenceDetail}${staticSignalEvidence}`
      : "The pull request has no changed files in the snapshot.",
    suggestion: "Manually verify boundary conditions, null handling, and failure paths around the changed logic.",
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

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:test:${toFindingId(filePath)}`,
    taskId: input.snapshot.taskId,
    severity: hasTestChanges ? "info" : "major",
    category: "test",
    filePath,
    title: hasTestChanges ? "Confirm test coverage matches the behavior change" : "Add or update tests for changed behavior",
    evidence: hasTestChanges
      ? `${input.riskAssessment.testFileCount} test file(s) changed in this PR.`
      : missingTestSignal
        ? `${missingTestSignal.message} ${missingTestSignal.evidence}`
      : contextFile && contextFile.testCandidatePaths.length > 0
        ? `No test file changes were detected. Candidate related tests include ${contextFile.testCandidatePaths.slice(0, 3).join(", ")}.`
        : "No test file changes were detected alongside source changes.",
    suggestion: hasTestChanges
      ? "Check that the updated tests cover both expected behavior and relevant failure paths."
      : "Add focused tests that exercise the changed behavior before merging.",
    confidence: hasTestChanges ? 0.55 : 0.72,
    blocking: !hasTestChanges && input.riskAssessment.riskLevel !== "low",
    status: "open"
  });
}

function createMaintainabilityFinding(input: ReviewModelInput): ReviewFinding {
  const file = findLargestFile(input.snapshot.changedFiles);

  return reviewFindingSchema.parse({
    id: `${input.snapshot.taskId}:maintainability:${toFindingId(file?.path ?? "pull-request")}`,
    taskId: input.snapshot.taskId,
    severity: file && file.changes >= 300 ? "major" : "minor",
    category: "maintainability",
    filePath: file?.path ?? "pull-request",
    title: "Keep the review focused on the largest change area",
    evidence: file
      ? `${file.path} is the largest changed file with ${file.changes} total line change(s).`
      : "The snapshot did not include changed files to prioritize.",
    suggestion: "If this file mixes unrelated concerns, split follow-up work or add comments only where they clarify non-obvious decisions.",
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
  return /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(path);
}

function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs)$/i.test(path);
}

function describeContextAvailability(file: {
  patch?: string;
  content?: string;
  contentTruncated?: boolean;
}): string {
  const sources = [];

  if (file.patch) {
    sources.push("patch is available");
  }

  if (file.content) {
    sources.push(file.contentTruncated ? "truncated file content is available" : "full file content is available");
  }

  return sources.length > 0 ? `Review context: ${sources.join("; ")}.` : "Review context only includes file metadata.";
}

function describeStaticSignals(input: ReviewModelInput, filePath: string | undefined): string {
  if (!filePath) {
    return "";
  }

  const signals = input.staticAnalysis.signals.filter((signal) => signal.filePath === filePath).slice(0, 2);

  if (signals.length === 0) {
    return "";
  }

  return ` Static analysis signals: ${signals.map((signal) => `${signal.ruleId} (${signal.severity}, ${signal.confidence})`).join("; ")}.`;
}

function toFindingId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "pull-request";
}
