#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import ts from "typescript";

const LINE_LIMIT = 300;
const INDENT_LEVEL_LIMIT = 4;
const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);

const [metric, ...options] = process.argv.slice(2);
const check = options.includes("--check");

if (!new Set(["lines", "indentation"]).has(metric)) {
  console.error(
    "Usage: node scripts/audit-source-limits.js <lines|indentation> [--check]",
  );
  process.exit(2);
}

const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(
    (file) => file && existsSync(file) && SOURCE_EXTENSIONS.has(extname(file)),
  );

const findings = [];

function isControlFlowNode(node) {
  return (
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node) ||
    ts.isDoStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isIfStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node) ||
    ts.isWhileStatement(node)
  );
}

function findDeepControlFlow(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const excessiveLines = [];
  let maximumDepth = 0;

  function visit(node, depth) {
    const startsFunction = ts.isFunctionLike(node) && node !== sourceFile;
    const parentIsElseIf =
      ts.isIfStatement(node) &&
      ts.isIfStatement(node.parent) &&
      node.parent.elseStatement === node;
    const nextDepth =
      (startsFunction ? 0 : depth) +
      (isControlFlowNode(node) && !parentIsElseIf ? 1 : 0);

    maximumDepth = Math.max(maximumDepth, nextDepth);
    if (nextDepth > INDENT_LEVEL_LIMIT) {
      excessiveLines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }

    ts.forEachChild(node, (child) => visit(child, nextDepth));
  }

  visit(sourceFile, 0);
  return { excessiveLines: [...new Set(excessiveLines)], maximumDepth };
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  if (lines.at(-1) === "") {
    lines.pop();
  }

  if (metric === "lines" && lines.length > LINE_LIMIT) {
    findings.push(`${file}: ${lines.length} lines`);
  }

  if (metric === "indentation") {
    const { excessiveLines, maximumDepth } = findDeepControlFlow(file, source);

    if (excessiveLines.length > 0) {
      const examples = excessiveLines.slice(0, 5).join(", ");
      const suffix = excessiveLines.length > 5 ? ", ..." : "";
      findings.push(
        `${file}: ${excessiveLines.length} node(s), max ${maximumDepth} levels ` +
          `(lines ${examples}${suffix})`,
      );
    }
  }
}

const description =
  metric === "lines"
    ? `source files over ${LINE_LIMIT} lines`
    : `source files with control flow deeper than ${INDENT_LEVEL_LIMIT} levels`;

if (findings.length === 0) {
  console.log(`No ${description}.`);
  process.exit(0);
}

console.log(`${findings.length} ${description}:`);
for (const finding of findings) {
  console.log(`- ${finding}`);
}

if (check) {
  process.exitCode = 1;
}
