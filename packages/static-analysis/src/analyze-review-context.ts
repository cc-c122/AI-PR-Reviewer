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
      signals.push(createSignal(file, "large-change", "size", "medium", `Large file-level change: ${file.changes} lines changed.`, `${file.path} changed ${file.changes} line(s).`, 0.72));
    }

    if (!hasTestChange && !file.isTestFile && file.testCandidatePaths.length > 0) {
      signals.push(
        createSignal(
          file,
          "missing-test-change",
          "test",
          "medium",
          "Source change has no changed test file in this PR.",
          `Candidate related tests: ${file.testCandidatePaths.slice(0, 3).join(", ")}.`,
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
  const text = getAnalyzableText(file);
  const signals: StaticAnalysisSignal[] = [];

  if (!text) {
    return signals;
  }

  const patterns = [
    {
      ruleId: "hardcoded-secret",
      pattern: /\b(token|password|secret|api[_-]?key)\b\s*[:=]\s*["'][^"']{8,}["']/iu,
      message: "Possible hardcoded token/password/secret pattern."
    },
    {
      ruleId: "eval-usage",
      pattern: /\beval\s*\(/u,
      message: "Use of eval-like dynamic code execution."
    },
    {
      ruleId: "dangerous-html",
      pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/u,
      message: "Potentially unsafe HTML injection sink."
    }
  ];

  for (const rule of patterns) {
    const evidence = findEvidence(text, rule.pattern);

    if (evidence) {
      signals.push(createSignal(file, rule.ruleId, "security", "high", rule.message, evidence, 0.74));
    }
  }

  return signals;
}

function scanMaintainabilityPatterns(file: ReviewContextFile): StaticAnalysisSignal[] {
  const text = getAnalyzableText(file);
  const signals: StaticAnalysisSignal[] = [];

  if (!text) {
    return signals;
  }

  const anyCount = countMatches(text, /\bany\b/gu);
  const todoEvidence = findEvidence(text, /\b(TODO|FIXME)\b/iu);
  const consoleEvidence = findEvidence(text, /console\.log\s*\(/u);

  if (anyCount >= 5) {
    signals.push(createSignal(file, "many-any", "maintainability", "medium", "Many TypeScript any usages detected.", `${anyCount} occurrences of "any".`, 0.65));
  }

  if (todoEvidence) {
    signals.push(createSignal(file, "todo-fixme", "maintainability", "low", "TODO/FIXME marker detected in changed context.", todoEvidence, 0.58));
  }

  if (consoleEvidence) {
    signals.push(createSignal(file, "console-log", "maintainability", "low", "console.log detected in changed context.", consoleEvidence, 0.62));
  }

  return signals;
}

function createSignal(
  file: ReviewContextFile,
  ruleId: string,
  category: StaticAnalysisSignal["category"],
  severity: StaticSignalSeverity,
  message: string,
  evidence: string,
  confidence: number,
): StaticAnalysisSignal {
  return {
    id: `${file.path}:${ruleId}`,
    filePath: file.path,
    ruleId,
    category,
    severity,
    message,
    evidence,
    confidence
  };
}

function buildRiskHints(signals: StaticAnalysisSignal[], skippedFiles: SkippedStaticAnalysisFile[]): string[] {
  const hints = signals.map((signal) => `${signal.severity.toUpperCase()} ${signal.ruleId} in ${signal.filePath}: ${signal.message}`);

  if (skippedFiles.length > 0) {
    hints.push(`Skipped ${skippedFiles.length} generated/lock/build file(s) to reduce noise.`);
  }

  return hints;
}

function getAnalyzableText(file: ReviewContextFile): string {
  return [file.patch, file.content].filter((value): value is string => Boolean(value)).join("\n");
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
