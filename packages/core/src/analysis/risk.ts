import { ChangedFile, PullRequestSnapshot } from "../types/analysis";

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export type ChangedFileRiskSignal = {
  filePath: string;
  score: number;
  reasons: string[];
};

export type PullRequestRiskAssessment = {
  riskLevel: RiskLevel;
  totalChanges: number;
  changedFileCount: number;
  testFileCount: number;
  fileSignals: ChangedFileRiskSignal[];
};

const criticalPathPatterns = [
  /(^|\/)(auth|security|payment|billing|database|db|migration|migrations)(\/|$)/i,
  /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/i
];

export function assessPullRequestRisk(snapshot: PullRequestSnapshot): PullRequestRiskAssessment {
  const fileSignals = snapshot.changedFiles.map(scoreChangedFile);
  const totalChanges = snapshot.changedFiles.reduce((sum, file) => sum + file.changes, 0);
  const changedFileCount = snapshot.changedFiles.length;
  const testFileCount = snapshot.changedFiles.filter(isTestFile).length;
  const highSignalCount = fileSignals.filter((signal) => signal.score >= 5).length;
  const hasTestCoverageSignal = testFileCount > 0;

  let riskLevel: RiskLevel = "low";

  if (changedFileCount === 0) {
    riskLevel = "unknown";
  } else if (totalChanges >= 800 || changedFileCount >= 20 || highSignalCount >= 3) {
    riskLevel = "high";
  } else if (
    totalChanges >= 200 ||
    changedFileCount >= 8 ||
    highSignalCount >= 1 ||
    (!hasTestCoverageSignal && hasSourceFile(snapshot.changedFiles))
  ) {
    riskLevel = "medium";
  }

  return {
    riskLevel,
    totalChanges,
    changedFileCount,
    testFileCount,
    fileSignals
  };
}

export function scoreChangedFile(file: ChangedFile): ChangedFileRiskSignal {
  const reasons: string[] = [];
  let score = 0;

  if (file.changes >= 300) {
    score += 4;
    reasons.push("large file-level diff");
  } else if (file.changes >= 100) {
    score += 2;
    reasons.push("moderate file-level diff");
  }

  if (file.status === "removed") {
    score += 2;
    reasons.push("file removed");
  }

  if (file.status === "renamed") {
    score += 1;
    reasons.push("file renamed");
  }

  if (criticalPathPatterns.some((pattern) => pattern.test(file.path))) {
    score += 3;
    reasons.push("critical path changed");
  }

  if (file.patch && /\b(TODO|FIXME|throw new Error|any|as unknown as)\b/.test(file.patch)) {
    score += 1;
    reasons.push("patch contains review-worthy markers");
  }

  if (isTestFile(file)) {
    score = Math.max(0, score - 1);
    reasons.push("test file changed");
  }

  return {
    filePath: file.path,
    score,
    reasons
  };
}

export function isTestFile(file: ChangedFile): boolean {
  return /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(file.path);
}

function hasSourceFile(files: ChangedFile[]): boolean {
  return files.some((file) => !isTestFile(file) && /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs)$/i.test(file.path));
}
