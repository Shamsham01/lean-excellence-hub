"use client";

import { createContext, useContext, type ReactNode } from "react";

const ModuleWriteContext = createContext(true);

export function ModuleWriteEntitlementProvider({
  writeAllowed,
  children,
}: {
  writeAllowed: boolean;
  children: ReactNode;
}) {
  return (
    <ModuleWriteContext.Provider value={writeAllowed}>
      {children}
    </ModuleWriteContext.Provider>
  );
}

export function usePlanModuleWriteAllowed() {
  return useContext(ModuleWriteContext);
}

/** Disables interactive controls when the plan blocks new writes in this module. */
export function ModuleMutationGuard({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePlanModuleWriteAllowed();
  if (!allowed) {
    return fallback;
  }
  return children;
}
