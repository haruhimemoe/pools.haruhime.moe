/**
 * @file tests/unit/tooling/jsdoc.test.ts
 * @desc Every source file starts with its header (@file naming its own path, @desc, @author,
 *       @created, @modified), and every export in src/ has a doc comment right above it;
 *       exported functions name themselves with @function and say what they return.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|mjs|css)$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });

const DECLARATION = /^export (?:default )?(?:async )?(const|function|type|class|let) (\w+)/;
const FUNCTION_VALUE =
  /^export (?:default )?(?:async )?const \w+(?:: [^=]+)? = (?:async )?(?:<|\()/;

describe("file headers", () => {
  it.each(["src", "scripts", "tests"])("start every file in %s", (dir) => {
    const missing = files(dir).filter((file) => {
      const head = readFileSync(file, "utf8").split("*/")[0] ?? "";
      const fields = ["@desc", "@author", "@created", "@modified"].every((tag) =>
        head.includes(tag),
      );
      return !head.includes(` * @file ${file.split(path.sep).join("/")}\n`) || !fields;
    });
    expect(missing).toEqual([]);
  });
});

describe("doc comments", () => {
  const exports = files("src")
    .filter((file) => /\.tsx?$/.test(file))
    .flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.flatMap((line, i) => {
        const match = DECLARATION.exec(line);
        if (!match) return [];
        let above = i - 1;
        while (above >= 0 && lines[above]?.startsWith("//")) above--;
        const docEnd = lines[above]?.trimEnd().endsWith("*/") ? above : -1;
        let docStart = docEnd;
        while (docStart > 0 && !lines[docStart]?.trimStart().startsWith("/**")) docStart--;
        const doc = docEnd < 0 ? "" : lines.slice(docStart, docEnd + 1).join("\n");
        const isFunction = match[1] === "function" || FUNCTION_VALUE.test(line);
        return [{ where: `${file}:${i + 1} ${match[2]}`, doc, isFunction }];
      });
    });

  it("sit above every export in src", () => {
    expect(exports.filter((entry) => entry.doc === "").map((entry) => entry.where)).toEqual([]);
  });

  it("name every exported function and say what it returns", () => {
    const thin = exports.filter(
      (entry) =>
        entry.isFunction && !(entry.doc.includes("@function") && entry.doc.includes("@returns")),
    );
    expect(thin.map((entry) => entry.where)).toEqual([]);
  });
});
