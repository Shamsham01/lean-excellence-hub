import { describe, expect, it } from "vitest";

import {
  emailPasswordSchema,
  passwordUpdateSchema,
  workforceLoginSchema,
} from "@/modules/identity/auth-input";

describe("authentication input boundaries", () => {
  it("canonicalises bounded email and workforce identifiers", () => {
    expect(
      emailPasswordSchema.parse({
        email: " Person@Example.TEST ",
        password: "not-logged",
      }).email,
    ).toBe("person@example.test");

    expect(
      workforceLoginSchema.parse({
        organisationCode: " Tenant-A ",
        password: "not-logged",
        workforceAlias: " Worker.001 ",
      }),
    ).toMatchObject({
      organisationCode: "tenant-a",
      workforceAlias: "worker.001",
    });
  });

  it("rejects non-ASCII and whitespace-confusable workforce aliases", () => {
    expect(
      workforceLoginSchema.safeParse({
        organisationCode: "tenant-a",
        password: "not-logged",
        workforceAlias: "wоrker-001",
      }).success,
    ).toBe(false);
    expect(
      workforceLoginSchema.safeParse({
        organisationCode: "tenant-a",
        password: "not-logged",
        workforceAlias: "worker 001",
      }).success,
    ).toBe(false);
  });

  it("enforces the configured password composition boundary", () => {
    expect(
      passwordUpdateSchema.safeParse({ password: "weakpassword" }).success,
    ).toBe(false);
    expect(
      passwordUpdateSchema.safeParse({ password: "Strong-Password-2026!" })
        .success,
    ).toBe(true);
  });
});
