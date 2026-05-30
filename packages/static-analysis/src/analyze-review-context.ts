import {
  PullRequestReviewContext,
  ReviewContextFile,
  StaticAnalysisResult,
  StaticAnalysisSignal
} from "@ai-pr-reviewer/core";
import { isLikelyGeneratedFile } from "./scanners/generated-file";

export type StaticSignalSeverity = "low" | "medium" | "high";

export type SkippedStaticAnalysisFile = {
  filePath: string;
  reason: "generated" | "lockfile" | "build_artifact";
};

const largeChangeThreshold = 300;
const introducedByPrSource = "introduced_by_pr" as const;
const contextOnlySource = "context_only" as const;

type PatternMatch = {
  evidence: string;
  confidence: number;
  source: StaticAnalysisSignal["source"];
  needsHumanConfirmation: boolean;
  line?: number;
};

export function analyzeReviewContext(reviewContext: PullRequestReviewContext): StaticAnalysisResult {
  const signals: StaticAnalysisSignal[] = [];
  const skippedFiles: SkippedStaticAnalysisFile[] = [];
  const hasTestChange = reviewContext.changedFiles.some((file) => file.isTestFile);

  for (const file of reviewContext.changedFiles) {
    const skipReason = getSkipReason(file.path);

    if (skipReason) {
      skippedFiles.push({
        filePath: file.path,
        reason: skipReason
      });
      continue;
    }

    if (file.changes >= largeChangeThreshold) {
      signals.push(createSignal(file, "large-change", "size", "medium", introducedByPrSource, false, `文件级变更较大，建议优先评审。`, `${file.path} 本次变更 ${file.changes} 行。`, 0.72));
    }

    if (!hasTestChange && !file.isTestFile && file.testCandidatePaths.length > 0) {
      signals.push(
        createSignal(
          file,
          "missing-test-change",
          "test",
          "medium",
          introducedByPrSource,
          false,
          "本次 PR 修改了源代码，但没有检测到测试文件变更。",
          `候选相关测试：${file.testCandidatePaths.slice(0, 3).join(", ")}。`,
          0.68,
        ),
      );
    }

    signals.push(...scanSecurityPatterns(file));
    signals.push(...scanMaintainabilityPatterns(file));
  }

  return {
    signals,
    skippedFiles,
    riskHints: buildRiskHints(signals, skippedFiles)
  };
}

function scanSecurityPatterns(file: ReviewContextFile): StaticAnalysisSignal[] {
  const signals: StaticAnalysisSignal[] = [];

  const patterns = [
    {
      ruleId: "hardcoded-secret",
      pattern: /\b(token|password|secret|api[_-]?key)\b\s*[:=]\s*["'][^"']{8,}["']/iu,
      message: "可能存在硬编码 token、password、secret 或 API key。"
    },
    {
      ruleId: "eval-usage",
      pattern: /\beval\s*\(/u,
      message: "检测到 eval 动态代码执行模式。"
    },
    {
      ruleId: "dangerous-html",
      pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/u,
      message: "检测到潜在不安全的 HTML 注入入口。"
    }
  ];

  for (const rule of patterns) {
    const match = findPatternMatch(file, rule.pattern, 0.74, 0.45);

    if (match) {
      signals.push(createSignal(file, rule.ruleId, "security", "high", match.source, match.needsHumanConfirmation, withContextOnlyMessage(rule.message, match), match.evidence, match.confidence, match.line));
    }
  }

  return signals;
}

function scanMaintainabilityPatterns(file: ReviewContextFile): StaticAnalysisSignal[] {
  const text = getAnalyzableText(file);
  const signals: StaticAnalysisSignal[] = [];
  const todoMatch = findPatternMatch(file, /\b(TODO|FIXME)\b/iu, 0.58, 0.35);
  const consoleMatch = findPatternMatch(file, /console\.log\s*\(/u, 0.62, 0.38);

  if (!text) {
    return signals;
  }

  const addedAnyCount = countMatches(getAddedLineText(file), /\bany\b/gu);
  const contextAnyCount = countMatches(text, /\bany\b/gu);

  if (addedAnyCount >= 3) {
    signals.push(createSignal(file, "many-any", "maintainability", "medium", introducedByPrSource, false, "新增行中出现较多 TypeScript any。", `新增行中出现 ${addedAnyCount} 个 any。`, 0.65));
  } else if (contextAnyCount >= 5) {
    signals.push(createSignal(file, "context-many-any", "maintainability", "low", contextOnlySource, true, "相关文件上下文中存在较多 TypeScript any，需要人工确认是否与本 PR 相关。", `相关文件上下文中存在 ${contextAnyCount} 个 any，需确认是否与本 PR 相关。`, 0.35));
  }

  if (todoMatch) {
    signals.push(createSignal(file, "todo-fixme", "maintainability", "low", todoMatch.source, todoMatch.needsHumanConfirmation, withContextOnlyMessage("变更上下文中检测到 TODO/FIXME 标记。", todoMatch), todoMatch.evidence, todoMatch.confidence, todoMatch.line));
  }

  if (consoleMatch) {
    signals.push(createSignal(file, "console-log", "maintainability", "low", consoleMatch.source, consoleMatch.needsHumanConfirmation, withContextOnlyMessage("变更上下文中检测到 console.log 调试输出。", consoleMatch), consoleMatch.evidence, consoleMatch.confidence, consoleMatch.line));
  }

  return signals;
}

function createSignal(
  file: ReviewContextFile,
  ruleId: string,
  category: StaticAnalysisSignal["category"],
  severity: StaticSignalSeverity,
  source: StaticAnalysisSignal["source"],
  needsHumanConfirmation: boolean,
  message: string,
  evidence: string,
  confidence: number,
  line?: number,
): StaticAnalysisSignal {
  const effectiveSeverity = normalizeContextOnlySeverity(source, severity);

  return {
    id: `${file.path}:${ruleId}`,
    filePath: file.path,
    ruleId,
    category,
    severity: effectiveSeverity,
    source,
    needsHumanConfirmation,
    message,
    evidence,
    confidence,
    ...(line !== undefined ? { line } : {})
  };
}

function buildRiskHints(signals: StaticAnalysisSignal[], skippedFiles: SkippedStaticAnalysisFile[]): string[] {
  const hints = signals.map((signal) => {
    const sourceLabel = signal.source === contextOnlySource ? " [context_only / 需要人工确认]" : "";

    return `${formatSeverityLabel(signal.severity)}${sourceLabel} ${signal.ruleId}（${signal.filePath}）：${signal.message}`;
  });

  if (skippedFiles.length > 0) {
    hints.push(`已跳过 ${skippedFiles.length} 个 generated/lock/build 文件，以减少噪声。`);
  }

  return hints;
}

function formatSeverityLabel(severity: StaticSignalSeverity): string {
  const labels = {
    high: "高",
    medium: "中",
    low: "低"
  } satisfies Record<StaticSignalSeverity, string>;

  return labels[severity];
}

function normalizeContextOnlySeverity(
  source: StaticAnalysisSignal["source"],
  severity: StaticSignalSeverity,
): StaticSignalSeverity {
  if (source === contextOnlySource && severity === "high") {
    return "medium";
  }

  return severity;
}

function getAnalyzableText(file: ReviewContextFile): string {
  return [file.patch, file.content].filter((value): value is string => Boolean(value)).join("\n");
}

function getAddedLineText(file: ReviewContextFile): string {
  return file.changedLines
    ?.filter((line) => line.type === "added")
    .map((line) => line.content)
    .join("\n") ?? "";
}

function findPatternMatch(
  file: ReviewContextFile,
  pattern: RegExp,
  introducedConfidence: number,
  contextConfidence: number,
): PatternMatch | null {
  const changedLineMatch = file.changedLines
    ?.filter((line) => line.type === "added")
    .find((line) => pattern.test(line.content));

  if (changedLineMatch) {
    return {
      evidence: changedLineMatch.content,
      confidence: introducedConfidence,
      source: introducedByPrSource,
      needsHumanConfirmation: false,
      line: changedLineMatch.line
    };
  }

  const evidence = findEvidence(getAnalyzableText(file), pattern);

  return evidence
    ? {
        evidence: `仅在相关上下文中发现，无法确认由本 PR 引入，需要人工确认：${evidence}`,
        confidence: contextConfidence,
        source: contextOnlySource,
        needsHumanConfirmation: true
      }
    : null;
}

function withContextOnlyMessage(message: string, match: PatternMatch): string {
  return match.source === contextOnlySource
    ? `${message} 仅在相关上下文中发现，无法确认由本 PR 引入，需要人工确认。`
    : message;
}

function getSkipReason(filePath: string): SkippedStaticAnalysisFile["reason"] | null {
  if (!isLikelyGeneratedFile(filePath)) {
    return null;
  }

  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/iu.test(filePath)) {
    return "lockfile";
  }

  if (/(^|\/)(dist|build|coverage)\//iu.test(filePath)) {
    return "build_artifact";
  }

  return "generated";
}

function findEvidence(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);

  if (!match || match.index === undefined) {
    return null;
  }

  const start = Math.max(0, match.index - 40);
  const end = Math.min(text.length, match.index + match[0].length + 40);

  return text.slice(start, end).replace(/\s+/gu, " ").trim();
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}
