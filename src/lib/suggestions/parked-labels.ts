export type ParkedPresentation = {
  showCurrentParked: boolean;
  showHistoricalParked: boolean;
};

export function deriveParkedPresentation(input: {
  status: string;
  parkedAt: string | null;
  parkedRationale: string | null;
}): ParkedPresentation {
  const hasParkedHistory = Boolean(
    input.parkedAt || input.parkedRationale?.trim(),
  );

  return {
    showCurrentParked: input.status === "parked" && hasParkedHistory,
    showHistoricalParked: input.status !== "parked" && hasParkedHistory,
  };
}

export function formatParkedDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
