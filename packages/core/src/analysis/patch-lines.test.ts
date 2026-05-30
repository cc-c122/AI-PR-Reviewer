import { describe, expect, it } from "vitest";
import { parsePatchChangedLines } from "./patch-lines";

describe("parsePatchChangedLines", () => {
  it("returns an empty list for an empty patch", () => {
    expect(parsePatchChangedLines("")).toEqual([]);
  });

  it("parses a single hunk with context and added lines", () => {
    expect(parsePatchChangedLines([
      "@@ -10,3 +10,4 @@",
      " const a = 1;",
      "+const b = 2;",
      " const c = 3;"
    ].join("\n"))).toEqual([
      { line: 10, content: "const a = 1;", type: "context" },
      { line: 11, content: "const b = 2;", type: "added" },
      { line: 12, content: "const c = 3;", type: "context" }
    ]);
  });

  it("parses multiple hunks", () => {
    expect(parsePatchChangedLines([
      "@@ -1,2 +1,3 @@",
      " one",
      "+two",
      "@@ -20,1 +21,2 @@",
      " twenty-one",
      "+twenty-two"
    ].join("\n"))).toEqual([
      { line: 1, content: "one", type: "context" },
      { line: 2, content: "two", type: "added" },
      { line: 21, content: "twenty-one", type: "context" },
      { line: 22, content: "twenty-two", type: "added" }
    ]);
  });

  it("uses new file line numbers for added lines", () => {
    const [addedLine] = parsePatchChangedLines("@@ -4,0 +5,2 @@\n+first\n+second");

    expect(addedLine).toEqual({ line: 5, content: "first", type: "added" });
  });

  it("does not emit removed lines as new file line suggestions", () => {
    expect(parsePatchChangedLines("@@ -10,2 +10,1 @@\n-old\n context")).toEqual([
      { line: 10, content: "context", type: "context" }
    ]);
  });

  it("ignores file header lines", () => {
    expect(parsePatchChangedLines("--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1,2 @@\n one\n+two")).toEqual([
      { line: 1, content: "one", type: "context" },
      { line: 2, content: "two", type: "added" }
    ]);
  });
});
