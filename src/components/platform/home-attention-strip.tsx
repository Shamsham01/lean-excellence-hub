import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import type { HomeAttentionItem } from "@/modules/platform-shell/home-attention";
import { cn } from "@/lib/utils";

export function HomeAttentionStrip({ items }: { items: HomeAttentionItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-lg border border-border bg-surface p-4"
      aria-labelledby="home-attention-heading"
      data-testid="home-attention-strip"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="home-attention-heading"
            className="text-base font-semibold text-foreground"
          >
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioritised items from your Lean system — open one to act.
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <AppLink
              href={item.href}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                item.tone === "urgent"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border",
              )}
              data-testid={`home-attention-${item.id}`}
            >
              <span className="font-medium">{item.label}</span>
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  item.tone === "urgent"
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {item.count}
              </span>
            </AppLink>
          </li>
        ))}
      </ul>
      {items.length === 1 && items[0]?.tone === "urgent" ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" asChild>
            <AppLink href={items[0].href}>Review {items[0].label.toLowerCase()}</AppLink>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
