import type { ProblemSolvingMethod } from "@/lib/problem-solving/types";

export type DraftMethodActivationView = {
  methodId: string;
  label: string;
  versionNumber: number;
  versionStatus: string;
  locked: boolean;
  summary: string | null;
};

export function problemSolvingMethodActivationSummary(
  method: Pick<ProblemSolvingMethod, "code" | "name" | "description">,
): string | null {
  const code = method.code.toLowerCase();
  const name = method.name.toLowerCase();

  if (code.includes("five-why") || name.includes("5 why")) {
    return "5 Why walks the team through repeated “why?” questions to reach a testable root cause before countermeasures.";
  }
  if (code.includes("a3") || name.includes("a3") || name.includes("8-step")) {
    return "A3 / 8-step structures the case from problem definition through root cause, countermeasures, verification, and sustainment on one narrative.";
  }
  if (code.includes("rapid") || name.includes("rapid")) {
    return "Rapid RCA is a shorter DMAIC-style path: define the gap, gather facts, verify cause, act, and confirm effectiveness.";
  }
  if (name.includes("8d")) {
    return "8D teams contain the issue, verify root cause, implement corrective actions, and prevent recurrence with disciplined checkpoints.";
  }
  if (name.includes("dmaic")) {
    return "DMAIC moves from Define and Measure through Analyze, Improve, and Control with explicit stage gates.";
  }

  return method.description;
}

type MethodActivationLookup = Pick<
  ProblemSolvingMethod,
  "id" | "name" | "code" | "description" | "current_version"
>;

export function resolveDraftMethodActivationView(input: {
  methodVersionId: string | null;
  methods: MethodActivationLookup[];
  pinnedVersion?: {
    methodId: string;
    methodName: string;
    methodCode: string;
    versionNumber: number;
    versionStatus: string;
  } | null;
}): DraftMethodActivationView | null {
  if (!input.methodVersionId) {
    return null;
  }

  const fromMethods = input.methods.find(
    (method) => method.current_version?.id === input.methodVersionId,
  );
  if (fromMethods?.current_version) {
    return {
      methodId: fromMethods.id,
      label: `${fromMethods.name} (v${fromMethods.current_version.version_number})`,
      versionNumber: fromMethods.current_version.version_number,
      versionStatus: fromMethods.current_version.status,
      locked: true,
      summary: problemSolvingMethodActivationSummary(fromMethods),
    };
  }

  if (input.pinnedVersion) {
    const method = input.methods.find(
      (entry) => entry.id === input.pinnedVersion?.methodId,
    );
    return {
      methodId: input.pinnedVersion.methodId,
      label: `${input.pinnedVersion.methodName} (v${input.pinnedVersion.versionNumber})`,
      versionNumber: input.pinnedVersion.versionNumber,
      versionStatus: input.pinnedVersion.versionStatus,
      locked: true,
      summary: method ? problemSolvingMethodActivationSummary(method) : null,
    };
  }

  return null;
}
