import { platformNavigation } from "@/modules/platform-shell/navigation";

const homeNavHref = "/platform";
const excludedHomeFallbackHrefs = new Set([
  homeNavHref,
  "/platform/settings/ai",
]);

export const platformHomeFallbackPermissions = Array.from(
  new Set(
    platformNavigation
      .filter((item) => !excludedHomeFallbackHrefs.has(item.href))
      .map((item) => item.permission)
      .filter((permission) => permission !== "maturity.read"),
  ),
);
