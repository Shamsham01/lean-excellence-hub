import { cn } from "@/lib/utils";

/** Subtle square grid for the auth brand panel (TailAdmin-inspired, LEH colours). */
export function AuthGridPattern({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden opacity-[0.35]",
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(255 255 255 / 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 255 255 / 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute -top-24 -right-24 size-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-72 rounded-full bg-primary/10 blur-3xl" />
    </div>
  );
}
