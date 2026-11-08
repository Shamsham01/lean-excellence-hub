#!/usr/bin/env node
/**
 * Replaces simple destructive inline alert paragraphs with InlineAlert.
 * Skips concurrent-work paths (leanai, actions, profile, empty-state).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const EXCLUDE =
  /(leanai\/|components\/actions\/|platform\/empty-state|settings\/profile\/|people\/me\/)/;

const files = execSync(
  `rg -l 'text-destructive.*role="alert"|role="alert".*text-destructive' src --glob '*.tsx'`,
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((f) => !EXCLUDE.test(f));

let changed = 0;
for (const file of files) {
  let src = readFileSync(file, "utf8");
  if (!src.includes("InlineAlert")) {
    if (src.includes('from "react"')) {
      src = src.replace(
        /from "react";/,
        'from "react";\n\nimport { InlineAlert } from "@/components/ui/alert";',
      );
    } else {
      src = `import { InlineAlert } from "@/components/ui/alert";\n${src}`;
    }
  }
  const next = src.replace(
    /<p className="text-sm text-destructive" role="alert">\s*([\s\S]*?)\s*<\/p>/g,
    '<InlineAlert tone="error">$1</InlineAlert>',
  );
  if (next !== src) {
    writeFileSync(file, next);
    changed += 1;
  }
}

console.log(`Updated ${changed} files`);
