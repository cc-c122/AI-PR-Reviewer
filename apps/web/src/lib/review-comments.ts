import { AnalysisReport, AnalysisTask, ReviewFinding } from "./api-client";

export function formatFindingComment(finding: ReviewFinding): string {
  const location = finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath;

  return [
    `### ${finding.title}`,
    "",
    `- **Severity / Category:** ${finding.severity} / ${finding.category}`,
    `- **Location:** \`${location}\``,
    `- **Confidence:** ${Math.round(finding.confidence * 100)}%`,
    `- **Blocking:** ${finding.blocking ? "yes" : "no"}`,
    "",
    "**Evidence**",
    finding.evidence,
    "",
    "**Suggestion**",
    finding.suggestion
  ].join("\n");
}

export function formatReviewSummary(report: AnalysisReport, task: AnalysisTask): string {
  const snapshot = task.snapshot;
  const pullRequestLabel = `${task.repositoryOwner}/${task.repositoryName}#${task.pullRequestNumber}`;
  const pullRequestLink = snapshot?.url ? ` (${snapshot.url})` : "";
  const blockingFindings = report.findings.filter((finding) => finding.blocking);
  const findingLines = report.findings.map((finding, index) => {
    const blocking = finding.blocking ? "blocking" : "non-blocking";

    return `${index + 1}. [${finding.severity}/${finding.category}/${blocking}] ${finding.filePath}: ${finding.title}`;
  });

  return [
    `## AI PR Review Summary for ${pullRequestLabel}${pullRequestLink}`,
    "",
    `**Risk level:** ${report.riskLevel}`,
    `**Findings:** ${report.findings.length}`,
    `**Blocking findings:** ${blockingFindings.length}`,
    "",
    report.summary,
    "",
    "### Findings",
    findingLines.length > 0 ? findingLines.join("\n") : "No findings were returned.",
    "",
    "### Review comments",
    report.findings.length > 0
      ? report.findings.map((finding) => formatFindingComment(finding)).join("\n\n---\n\n")
      : "No review comments to copy."
  ].join("\n");
}
