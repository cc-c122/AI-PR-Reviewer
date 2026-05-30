import { ContextSource, PullRequestReviewContext, buildPullRequestReviewContext } from "../context/review-context";
import { AnalysisReport, PullRequestSnapshot } from "../types/analysis";
import { assessPullRequestRisk, PullRequestRiskAssessment } from "./risk";
import { generatePullRequestSummary } from "./summary";

export type StaticAnalysisSignal = {
  id: string;
  filePath: string;
  ruleId: string;
  category: "security" | "maintainability" | "test" | "size";
  severity: "low" | "medium" | "high";
  source: "introduced_by_pr" | "context_only";
  needsHumanConfirmation: boolean;
  message: string;
  evidence: string;
  confidence: number;
  line?: number;
};

export type SkippedStaticAnalysisFile = {
  filePath: string;
  reason: "generated" | "lockfile" | "build_artifact";
};

export type StaticAnalysisResult = {
  signals: StaticAnalysisSignal[];
  skippedFiles: SkippedStaticAnalysisFile[];
  riskHints: string[];
};

export type ReviewContextFileSummary = {
  path: string;
  contextSources: ContextSource[];
  contentAvailable: boolean;
  contentTruncated: boolean;
  isTestFile: boolean;
  testCandidatePaths: string[];
};

export type ReviewContextSummary = {
  files: ReviewContextFileSummary[];
  contextSources: ContextSource[];
};

export type AnalysisDetails = {
  reviewContextSummary: ReviewContextSummary;
  staticAnalysis: StaticAnalysisResult;
  generatedAt: string;
};

export type AnalysisReportWithDetails = AnalysisReport & {
  details: AnalysisDetails;
};

export type AnalysisModelInput = {
  snapshot: PullRequestSnapshot;
  summary: string;
  riskAssessment: PullRequestRiskAssessment;
  reviewContext: PullRequestReviewContext;
  staticAnalysis: StaticAnalysisResult;
};

export interface AnalysisModelClient {
  generateReview(input: AnalysisModelInput): Promise<AnalysisReport>;
}

export async function generateAnalysisReport(
  snapshot: PullRequestSnapshot,
  modelClient: AnalysisModelClient,
  reviewContext: PullRequestReviewContext = buildPullRequestReviewContext(snapshot),
  staticAnalysis: StaticAnalysisResult = {
    signals: [],
    skippedFiles: [],
    riskHints: []
  },
): Promise<AnalysisReport> {
  const riskAssessment = assessPullRequestRisk(snapshot);
  const summary = generatePullRequestSummary(snapshot, riskAssessment);

  return modelClient.generateReview({
    snapshot,
    summary,
    riskAssessment,
    reviewContext,
    staticAnalysis
  });
}

export function buildAnalysisDetails(
  reviewContext: PullRequestReviewContext,
  staticAnalysis: StaticAnalysisResult,
  generatedAt: string = new Date().toISOString(),
): AnalysisDetails {
  return {
    reviewContextSummary: {
      files: reviewContext.changedFiles.map((file) => ({
        path: file.path,
        contextSources: file.contextSources,
        contentAvailable: file.content !== undefined,
        contentTruncated: file.contentTruncated ?? false,
        isTestFile: file.isTestFile,
        testCandidatePaths: file.testCandidatePaths
      })),
      contextSources: reviewContext.contextSources
    },
    staticAnalysis: sanitizeStaticAnalysis(staticAnalysis),
    generatedAt
  };
}

function sanitizeStaticAnalysis(staticAnalysis: StaticAnalysisResult): StaticAnalysisResult {
  return {
    signals: staticAnalysis.signals.map((signal) => ({
      ...signal,
      evidence: sanitizeEvidence(signal.evidence)
    })),
    skippedFiles: staticAnalysis.skippedFiles,
    riskHints: staticAnalysis.riskHints.map(sanitizeEvidence)
  };
}

function sanitizeEvidence(value: string): string {
  return truncateForDetails(
    value.replace(
      /\b(token|password|secret|api[_-]?key)\b(\s*[:=]\s*)["'][^"']+["']/giu,
      "$1$2\"[REDACTED]\"",
    ),
  );
}

function truncateForDetails(value: string): string {
  const maxLength = 240;

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
