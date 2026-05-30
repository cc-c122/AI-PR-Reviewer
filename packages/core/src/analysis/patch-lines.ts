export type ChangedPatchLine = {
  line: number;
  content: string;
  type: "added" | "removed" | "context";
};

const hunkHeaderPattern = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/u;

export function parsePatchChangedLines(patch: string): ChangedPatchLine[] {
  if (!patch.trim()) {
    return [];
  }

  const changedLines: ChangedPatchLine[] = [];
  let newLine = 0;
  let inHunk = false;

  for (const rawLine of patch.split(/\r?\n/u)) {
    const hunkMatch = rawLine.match(hunkHeaderPattern);

    if (hunkMatch?.groups) {
      newLine = Number(hunkMatch.groups.newStart);
      inHunk = true;
      continue;
    }

    if (!inHunk || rawLine.startsWith("+++") || rawLine.startsWith("---")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      changedLines.push({
        line: newLine,
        content: rawLine.slice(1),
        type: "added"
      });
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      continue;
    }

    if (rawLine.startsWith(" ")) {
      changedLines.push({
        line: newLine,
        content: rawLine.slice(1),
        type: "context"
      });
      newLine += 1;
    }
  }

  return changedLines;
}
