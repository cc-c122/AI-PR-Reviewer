import { PullRequestSnapshot } from "../types/analysis";
import { PullRequestRiskAssessment } from "./risk";

export function generatePullRequestSummary(
  snapshot: PullRequestSnapshot,
  assessment: PullRequestRiskAssessment,
): string {
  const topFiles = [...snapshot.changedFiles]
    .sort((left, right) => right.changes - left.changes)
    .slice(0, 3)
    .map((file) => `${file.path} (+${file.additions}/-${file.deletions})`);

  const topFileText = topFiles.length > 0 ? topFiles.join(", ") : "no changed files";

  return [
    `${snapshot.repositoryOwner}/${snapshot.repositoryName}#${snapshot.pullRequestNumber}: ${snapshot.title}`,
    `This PR changes ${assessment.changedFileCount} file(s) with ${assessment.totalChanges} total line change(s).`,
    `Primary changed files: ${topFileText}.`,
    `Base ${snapshot.baseRef}@${snapshot.baseSha.slice(0, 7)} -> head ${snapshot.headRef}@${snapshot.commitSha.slice(0, 7)}.`,
    `Initial risk level: ${assessment.riskLevel}.`
  ].join(" ");
}
