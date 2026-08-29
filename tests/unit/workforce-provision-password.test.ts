/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  generateWorkforceTemporaryPassword,
  satisfiesWorkforcePasswordPolicy,
} from "../../supabase/functions/_shared/workforce-provision/temporary-password.ts";

describe("generateWorkforceTemporaryPassword", () => {
  it("generates passwords that always satisfy the workforce policy", () => {
    for (let index = 0; index < 200; index += 1) {
      const password = generateWorkforceTemporaryPassword();
      expect(satisfiesWorkforcePasswordPolicy(password)).toBe(true);
    }
  });

  it("honours the requested length", () => {
    expect(generateWorkforceTemporaryPassword(20)).toHaveLength(20);
    expect(generateWorkforceTemporaryPassword(24)).toHaveLength(24);
  });
});
