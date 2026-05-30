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

  const topFileText = topFiles.length > 0 ? topFiles.join(", ") : "没有变更文件";
  const riskLevelLabels = {
    high: "高",
    medium: "中",
    low: "低",
    unknown: "未知"
  } satisfies Record<PullRequestRiskAssessment["riskLevel"], string>;

  return [
    `${snapshot.repositoryOwner}/${snapshot.repositoryName}#${snapshot.pullRequestNumber}: ${snapshot.title}`,
    `本次 PR 变更 ${assessment.changedFileCount} 个文件，共 ${assessment.totalChanges} 行。`,
    `主要变更文件：${topFileText}。`,
    `Base ${snapshot.baseRef}@${snapshot.baseSha.slice(0, 7)} -> Head ${snapshot.headRef}@${snapshot.commitSha.slice(0, 7)}。`,
    `初始风险等级：${riskLevelLabels[assessment.riskLevel]}。`
  ].join(" ");
}
