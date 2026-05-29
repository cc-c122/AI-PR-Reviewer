import { AnalysisReport, PullRequestSnapshot } from "../types/analysis";
import { assessPullRequestRisk, PullRequestRiskAssessment } from "./risk";
import { generatePullRequestSummary } from "./summary";

export type AnalysisModelInput = {
  snapshot: PullRequestSnapshot;
  summary: string;
  riskAssessment: PullRequestRiskAssessment;
};

export interface AnalysisModelClient {
  generateReview(input: AnalysisModelInput): Promise<AnalysisReport>;
}

export async function generateAnalysisReport(
  snapshot: PullRequestSnapshot,
  modelClient: AnalysisModelClient,
): Promise<AnalysisReport> {
  const riskAssessment = assessPullRequestRisk(snapshot);
  const summary = generatePullRequestSummary(snapshot, riskAssessment);

  return modelClient.generateReview({
    snapshot,
    summary,
    riskAssessment
  });
}
