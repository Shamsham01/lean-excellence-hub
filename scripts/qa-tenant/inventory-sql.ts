import { QA_ORGANISATION_CODE } from "./constants";
import {
  collectTenantInventoryViaSql,
  type TenantInventorySqlPayload,
} from "./tenant-inventory-sql";

export type InventorySqlPayload = TenantInventorySqlPayload;

export function collectCookieWorksInventoryViaSql(databaseUrl: string) {
  return collectTenantInventoryViaSql(databaseUrl, QA_ORGANISATION_CODE);
}
