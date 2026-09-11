"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  ACTIVE_SITE_COOKIE,
  ALL_SITES_COOKIE_VALUE,
  listAccessibleSites,
} from "@/modules/organisation/site-context";
import { loadAccessibleOrganisationUnits } from "@/modules/organisation/site-context-server";

const requestedSiteSchema = z.union([
  z.literal(ALL_SITES_COOKIE_VALUE),
  z.uuid(),
]);

const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 180,
};

export async function setActiveSiteContext(rawValue: string) {
  const parsed = requestedSiteSchema.safeParse(rawValue);
  if (!parsed.success) {
    return { error: "That site is not available." };
  }

  const store = await cookies();

  if (parsed.data === ALL_SITES_COOKIE_VALUE) {
    store.set(ACTIVE_SITE_COOKIE, ALL_SITES_COOKIE_VALUE, cookieOptions);
    revalidatePath("/platform", "layout");
    return { ok: true as const };
  }

  const units = await loadAccessibleOrganisationUnits();
  const sites = listAccessibleSites(units);
  if (!sites.some((site) => site.id === parsed.data)) {
    return { error: "That site is not available." };
  }

  store.set(ACTIVE_SITE_COOKIE, parsed.data, cookieOptions);
  revalidatePath("/platform", "layout");
  return { ok: true as const };
}
