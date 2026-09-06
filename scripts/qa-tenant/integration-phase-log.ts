/**
 * High-signal timing logs for QA tenant integration tests.
 * Enabled automatically when hosted-replacement integration is forced (CI/local).
 */

const DEFAULT_ENABLED =
  process.env.LEANHUB_FORCE_LEGACY_REPLACEMENT_INTEGRATION === "1" ||
  process.env.LEANHUB_QA_INTEGRATION_TIMING === "1";

export type IntegrationPhaseLogContext = {
  testName?: string;
  phaseStartedAtMs: number;
  lastPhaseStartedAtMs: number;
};

let enabled = DEFAULT_ENABLED;
let context: IntegrationPhaseLogContext | undefined;

export function setIntegrationPhaseLogging(active: boolean) {
  enabled = active;
}

export function startIntegrationTest(testName: string) {
  const now = Date.now();
  context = {
    testName,
    phaseStartedAtMs: now,
    lastPhaseStartedAtMs: now,
  };
  if (enabled) {
    console.log(`[QA2e] TEST START ${testName}`);
  }
}

export function logIntegrationPhaseStart(phase: string) {
  if (!context) {
    return;
  }
  context.lastPhaseStartedAtMs = Date.now();
  if (enabled) {
    console.log(
      `[QA2e] PHASE START ${context.testName ?? "unknown"} :: ${phase}`,
    );
  }
}

export function logIntegrationPhaseEnd(phase: string) {
  if (!context) {
    return;
  }
  const elapsedMs = Date.now() - context.lastPhaseStartedAtMs;
  if (enabled) {
    console.log(
      `[QA2e] PHASE END ${context.testName ?? "unknown"} :: ${phase} elapsedMs=${elapsedMs}`,
    );
  }
}

export function endIntegrationTest() {
  if (!context) {
    return;
  }
  const elapsedMs = Date.now() - context.phaseStartedAtMs;
  if (enabled) {
    console.log(
      `[QA2e] TEST END ${context.testName ?? "unknown"} elapsedMs=${elapsedMs}`,
    );
  }
  context = undefined;
}

export async function runIntegrationPhase<T>(
  phase: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  logIntegrationPhaseStart(phase);
  try {
    return await fn();
  } finally {
    logIntegrationPhaseEnd(phase);
  }
}
