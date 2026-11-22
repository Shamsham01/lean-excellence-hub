import { LehBrandHomeLink } from "@/components/brand/leh-brand";
import { cn } from "@/lib/utils";

/** Horizontal lockup for sign-in and invitation surfaces (PNG, object-fit contain). */
export function AuthBrandMark({
  className,
  showStrapline = false,
  lockupOnDarkSurface = false,
}: {
  className?: string;
  showStrapline?: boolean;
  /** Use the dark-background horizontal lockup (login brand panel). */
  lockupOnDarkSurface?: boolean;
}) {
  return (
    <div
      className={cn(
        "leh-brand-auth-shell flex flex-col items-center gap-3 text-center",
        className,
      )}
    >
      <LehBrandHomeLink lockupOnDarkSurface={lockupOnDarkSurface} />
      {showStrapline ? (
        <p className="max-w-sm text-sm text-muted-foreground">
          Operational excellence for manufacturing organisations
        </p>
      ) : null}
    </div>
  );
}
