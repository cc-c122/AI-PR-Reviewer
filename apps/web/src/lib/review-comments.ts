import { AnalysisReport, AnalysisTask, ReviewFinding } from "./api-client";

export function formatFindingComment(finding: ReviewFinding): string {
  const location = finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath;

  return [
    `### ${finding.title}`,
    "",
    `- **严重级别 / 类型:** ${finding.severity} / ${finding.category}`,
    `- **位置:** \`${location}\``,
    `- **置信度:** ${Math.round(finding.confidence * 100)}%`,
    `- **是否阻塞:** ${finding.blocking ? "是" : "否"}`,
    "",
    "**证据**",
    finding.evidence,
    "",
    "**建议**",
    finding.suggestion
  ].join("\n");
}

export function formatReviewSummary(report: AnalysisReport, task: AnalysisTask): string {
  const snapshot = task.snapshot;
  const pullRequestLabel = `${task.repositoryOwner}/${task.repositoryName}#${task.pullRequestNumber}`;
  const pullRequestLink = snapshot?.url ? ` (${snapshot.url})` : "";
  const blockingFindings = report.findings.filter((finding) => finding.blocking);
  const findingLines = report.findings.map((finding, index) => {
    const blocking = finding.blocking ? "阻塞" : "非阻塞";

    return `${index + 1}. [${finding.severity}/${finding.category}/${blocking}] ${finding.filePath}: ${finding.title}`;
  });

  return [
    `## AI PR Review 摘要：${pullRequestLabel}${pullRequestLink}`,
    "",
    `**风险级别:** ${report.riskLevel}`,
    `**问题数量:** ${report.findings.length}`,
    `**阻塞问题:** ${blockingFindings.length}`,
    "",
    report.summary,
    "",
    "### 问题列表",
    findingLines.length > 0 ? findingLines.join("\n") : "未返回 Review 问题。",
    "",
    "### Review 评论",
    report.findings.length > 0
      ? report.findings.map((finding) => formatFindingComment(finding)).join("\n\n---\n\n")
      : "没有可复制的 Review 评论。"
  ].join("\n");
}
