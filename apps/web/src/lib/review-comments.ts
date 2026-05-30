import { AnalysisReport, AnalysisTask, ReviewFinding } from "./api-client";

const severityLabels = {
  critical: "严重",
  major: "主要",
  minor: "次要",
  info: "提示"
} as const;

const categoryLabels = {
  bug: "缺陷",
  security: "安全",
  performance: "性能",
  maintainability: "可维护性",
  test: "测试",
  docs: "文档",
  style: "风格"
} as const;

const riskLevelLabels = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未知"
} as const;

export function formatFindingComment(finding: ReviewFinding): string {
  const location = finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath;

  return [
    `### ${finding.title}`,
    "",
    `- **严重程度 / 类型:** ${severityLabels[finding.severity]} / ${categoryLabels[finding.category]}`,
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

    return `${index + 1}. [${severityLabels[finding.severity]}/${categoryLabels[finding.category]}/${blocking}] ${finding.filePath}: ${finding.title}`;
  });

  return [
    `## AI PR 评审摘要：${pullRequestLabel}${pullRequestLink}`,
    "",
    `**风险等级:** ${riskLevelLabels[report.riskLevel]}`,
    `**问题数量:** ${report.findings.length}`,
    `**阻塞问题:** ${blockingFindings.length}`,
    "",
    report.summary,
    "",
    "### 问题列表",
    findingLines.length > 0 ? findingLines.join("\n") : "未返回评审问题。",
    "",
    "### 评审评论",
    report.findings.length > 0
      ? report.findings.map((finding) => formatFindingComment(finding)).join("\n\n---\n\n")
      : "没有可复制的评审评论。"
  ].join("\n");
}
