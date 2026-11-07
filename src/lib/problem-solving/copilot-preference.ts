export type PpsCopilotPreference = {
  mobileOpen: boolean;
  dockCollapsed: boolean;
};

const STORAGE_PREFIX = "pps-lean-ai-copilot:";

export function ppsCopilotStorageKey(caseId: string): string {
  return `${STORAGE_PREFIX}${caseId}`;
}

export function readPpsCopilotPreference(
  caseId: string,
): PpsCopilotPreference | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(ppsCopilotStorageKey(caseId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PpsCopilotPreference>;
    return {
      mobileOpen: Boolean(parsed.mobileOpen),
      dockCollapsed: Boolean(parsed.dockCollapsed),
    };
  } catch {
    return null;
  }
}

export function writePpsCopilotPreference(
  caseId: string,
  preference: PpsCopilotPreference,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      ppsCopilotStorageKey(caseId),
      JSON.stringify(preference),
    );
  } catch {
    // ignore quota / private mode
  }
}
