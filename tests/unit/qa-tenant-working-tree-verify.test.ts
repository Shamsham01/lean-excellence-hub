import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NEXT_ENV_RELATIVE_PATH,
  readTrackedFileBytes,
  restoreNextEnvIfOnlyTypegenImportDrift,
} from "../../scripts/qa-tenant/working-tree-verify";

describe("restoreNextEnvIfOnlyTypegenImportDrift", () => {
  it("restores next-env.d.ts when only typegen import paths differ", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "qa-next-env-"));
    const absolutePath = join(repoRoot, NEXT_ENV_RELATIVE_PATH);
    const original = `/// <reference types="next" />
import "./.next/dev/types/routes.d.ts";
`;
    writeFileSync(absolutePath, original, "utf8");
    const originalBytes = readTrackedFileBytes(
      repoRoot,
      NEXT_ENV_RELATIVE_PATH,
    );

    writeFileSync(
      absolutePath,
      original.replace(".next/dev/types", ".next/types"),
      "utf8",
    );

    restoreNextEnvIfOnlyTypegenImportDrift(repoRoot, originalBytes);

    expect(
      readTrackedFileBytes(repoRoot, NEXT_ENV_RELATIVE_PATH).toString("utf8"),
    ).toBe(original);
  });
});
