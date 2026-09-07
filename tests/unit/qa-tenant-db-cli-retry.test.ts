import { describe, expect, it, vi } from "vitest";

import {
  executeWithOptionalTransientConnectionRetry,
  SupabaseDbQueryError,
  TRANSIENT_DB_CONNECTION_RETRY_MAX_ATTEMPTS,
} from "../../scripts/qa-tenant/db-cli";

describe("executeWithOptionalTransientConnectionRetry", () => {
  function throwTransientError() {
    throw new SupabaseDbQueryError(
      "connection terminated unexpectedly",
      "",
      "",
    );
  }

  it("retries read-only opt-in queries on transient connection failures", () => {
    const execute = vi
      .fn()
      .mockImplementationOnce(throwTransientError)
      .mockImplementationOnce(throwTransientError)
      .mockReturnValueOnce("ok");

    const output = executeWithOptionalTransientConnectionRetry(true, execute);

    expect(output).toBe("ok");
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("bounds read-only opt-in retries to TRANSIENT_DB_CONNECTION_RETRY_MAX_ATTEMPTS", () => {
    const execute = vi.fn().mockImplementation(throwTransientError);

    expect(() =>
      executeWithOptionalTransientConnectionRetry(true, execute),
    ).toThrow(SupabaseDbQueryError);

    expect(execute).toHaveBeenCalledTimes(
      TRANSIENT_DB_CONNECTION_RETRY_MAX_ATTEMPTS,
    );
  });

  it("does not retry destructive queries by default", () => {
    const execute = vi.fn().mockImplementation(throwTransientError);

    expect(() =>
      executeWithOptionalTransientConnectionRetry(false, execute),
    ).toThrow(SupabaseDbQueryError);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not treat heavy timeout configuration as retry opt-in", () => {
    const execute = vi.fn().mockImplementation(throwTransientError);

    expect(() =>
      executeWithOptionalTransientConnectionRetry(false, execute),
    ).toThrow(SupabaseDbQueryError);

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
