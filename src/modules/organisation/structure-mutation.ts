import { SITE_CAPACITY_EXHAUSTED } from "@/modules/billing/site-capacity";

export type StructureMutationResult = {
  ok?: true;
  error?: string;
  errorCode?: typeof SITE_CAPACITY_EXHAUSTED;
  canManageBilling?: boolean;
};
