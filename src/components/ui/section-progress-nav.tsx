"use client";

import { Check } from "lucide-react";

import {
  sectionNavAriaLabel,
  sectionNavVisualState,
  type SectionCompletionState,
  type SectionNavVisualState,
} from "@/modules/operational/section-visual-state";
import { cn } from "@/lib/utils";

export type SectionProgressNavItem = {
  id: string;
  label: string;
  completion: SectionCompletionState;
  detail?: string;
  disabled?: boolean;
};

export type SectionProgressNavGroup = {
  id: string;
  label: string;
  completion: SectionCompletionState;
  itemIds: string[];
};

type SectionProgressNavProps = {
  ariaLabel: string;
  items: SectionProgressNavItem[];
  groups?: SectionProgressNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  layout?: "workspace" | "chips" | "stack";
  disabled?: boolean;
  testId?: string;
  testIdPrefix?: string;
  className?: string;
};

function NavStatusIcon({
  visual,
  index,
}: {
  visual: SectionNavVisualState;
  index?: number;
}) {
  if (visual === "complete") {
    return <Check className="size-4" strokeWidth={2.5} aria-hidden />;
  }
  if (visual === "partial") {
    return (
      <span
        className="size-2.5 rounded-full bg-warning"
        aria-hidden
        data-testid="section-progress-partial-marker"
      />
    );
  }
  if (typeof index === "number") {
    return (
      <span className="font-mono-data text-xs font-semibold" aria-hidden>
        {index + 1}
      </span>
    );
  }
  return (
    <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
  );
}

function sidebarButtonClasses(visual: SectionNavVisualState) {
  return cn(
    "group flex w-full min-h-11 items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    visual === "current" &&
      "bg-primary/10 shadow-[0_0_16px_rgb(70_95_255/0.35)] ring-2 ring-primary/45",
    visual === "complete" && "bg-success/10 hover:bg-success/15",
    visual === "partial" && "hover:bg-warning/10",
    visual === "not_started" && "hover:bg-accent/60",
  );
}

function sidebarIconClasses(visual: SectionNavVisualState) {
  return cn(
    "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
    visual === "complete" &&
      "border-success bg-success text-success-foreground",
    visual === "current" &&
      "border-primary bg-card text-primary shadow-[0_0_12px_rgb(70_95_255/0.45)]",
    visual === "partial" &&
      "border-warning/60 bg-warning/15 text-warning-foreground",
    visual === "not_started" &&
      "border-border bg-card text-muted-foreground",
  );
}

function chipButtonClasses(visual: SectionNavVisualState) {
  return cn(
    "flex min-h-11 min-w-[8.5rem] max-w-full shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    visual === "complete" && "border-success/30 bg-success/10",
    visual === "current" && "border-primary/50 bg-primary/5 shadow-sm",
    visual === "partial" && "border-warning/40 bg-warning/10",
    visual === "not_started" && "border-border/50 bg-card",
  );
}

function GroupHeader({
  group,
}: {
  group: SectionProgressNavGroup;
}) {
  const visual = group.completion;
  return (
    <p
      className={cn(
        "flex items-center gap-2 px-2 pt-2 text-xs font-semibold tracking-wide uppercase",
        visual === "complete" && "text-success",
        visual === "partial" && "text-warning-foreground",
        visual === "not_started" && "text-muted-foreground",
      )}
      data-testid={`section-progress-group-${group.id}`}
      data-completion-state={group.completion}
    >
      {visual === "complete" ? (
        <Check className="size-3.5 shrink-0" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{group.label}</span>
    </p>
  );
}

function SectionProgressButton({
  item,
  visual,
  active,
  disabled,
  testId,
  onSelect,
  variant,
  index,
}: {
  item: SectionProgressNavItem;
  visual: SectionNavVisualState;
  active: boolean;
  disabled?: boolean;
  testId: string;
  onSelect: (id: string) => void;
  variant: "sidebar" | "chip";
  index?: number;
}) {
  const completionState =
    visual === "current" ? item.completion : visual;

  return (
    <button
      type="button"
      data-testid={testId}
      data-completion-state={completionState}
      data-active={active ? "true" : "false"}
      aria-current={active ? "step" : undefined}
      aria-label={sectionNavAriaLabel(item.label, visual, item.detail)}
      disabled={disabled}
      onClick={() => onSelect(item.id)}
      className={cn(
        variant === "sidebar" ? sidebarButtonClasses(visual) : chipButtonClasses(visual),
        disabled && "opacity-70",
      )}
    >
      {variant === "sidebar" ? (
        <>
          <span className={sidebarIconClasses(visual)}>
            <NavStatusIcon
              visual={visual}
              {...(typeof index === "number" ? { index } : {})}
            />
          </span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span
              className={cn(
                "block leading-snug font-medium break-words",
                visual === "not_started" && "text-muted-foreground",
              )}
            >
              {item.label}
            </span>
            {item.detail ? (
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            ) : null}
          </span>
        </>
      ) : (
        <>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border",
              visual === "complete" &&
                "border-success/40 bg-success/15 text-success",
              visual === "current" &&
                "border-primary bg-primary text-primary-foreground",
              visual === "partial" &&
                "border-warning/50 bg-warning/15 text-warning-foreground",
              visual === "not_started" && "border-border bg-elevated",
            )}
          >
            <NavStatusIcon
              visual={visual}
              {...(typeof index === "number" ? { index } : {})}
            />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
        </>
      )}
    </button>
  );
}

export function SectionProgressNav({
  ariaLabel,
  items,
  groups,
  activeId,
  onSelect,
  layout = "workspace",
  disabled = false,
  testId = "section-progress-nav",
  testIdPrefix = "section-progress",
  className,
}: SectionProgressNavProps) {
  const itemById = new Map(items.map((item) => [item.id, item] as const));

  const renderItems = (subset: SectionProgressNavItem[], variant: "sidebar" | "chip") =>
    subset.map((item, index) => {
      const visual = sectionNavVisualState(
        item.completion,
        item.id === activeId,
      );
      return (
        <SectionProgressButton
          key={item.id}
          item={item}
          visual={visual}
          active={item.id === activeId}
          disabled={Boolean(disabled || item.disabled)}
          testId={`${testIdPrefix}-${item.id}`}
          onSelect={onSelect}
          variant={variant}
          index={index}
        />
      );
    });

  if (layout === "stack") {
    return (
      <nav
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn("flex min-w-0 flex-col gap-2", className)}
      >
        {groups?.length
          ? groups.map((group) => {
              const groupItems = group.itemIds
                .map((id) => itemById.get(id))
                .filter((item): item is SectionProgressNavItem => Boolean(item));
              return (
                <div key={group.id} className="min-w-0">
                  <GroupHeader group={group} />
                  <div className="mt-1 flex flex-col gap-0.5">
                    {renderItems(groupItems, "sidebar")}
                  </div>
                </div>
              );
            })
          : renderItems(items, "sidebar")}
      </nav>
    );
  }

  if (layout === "chips") {
    return (
      <nav
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          "tabs-scroll max-w-full min-w-0 overflow-x-auto pb-1",
          className,
        )}
      >
        <ol className="flex min-w-max gap-2">
          {items.map((item, index) => {
            const visual = sectionNavVisualState(
              item.completion,
              item.id === activeId,
            );
            return (
              <li key={item.id}>
                <SectionProgressButton
                  item={item}
                  visual={visual}
                  active={item.id === activeId}
                  disabled={Boolean(disabled || item.disabled)}
                  testId={`${testIdPrefix}-mobile-${item.id}`}
                  onSelect={onSelect}
                  variant="chip"
                  index={index}
                />
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  const orderedItems = groups?.length
    ? groups.flatMap((group) =>
        group.itemIds
          .map((id) => itemById.get(id))
          .filter((item): item is SectionProgressNavItem => Boolean(item)),
      )
    : items;

  return (
    <>
      <nav
        aria-label={ariaLabel}
        data-testid={`${testId}-mobile`}
        className={cn(
          "tabs-scroll max-w-full min-w-0 overflow-x-auto pb-2 lg:hidden",
          className,
        )}
      >
        <ol className="flex min-w-max gap-2">
          {orderedItems.map((item, index) => {
            const visual = sectionNavVisualState(
              item.completion,
              item.id === activeId,
            );
            return (
              <li key={item.id}>
                <SectionProgressButton
                  item={item}
                  visual={visual}
                  active={item.id === activeId}
                  disabled={Boolean(disabled || item.disabled)}
                  testId={`${testIdPrefix}-mobile-${item.id}`}
                  onSelect={onSelect}
                  variant="chip"
                  index={index}
                />
              </li>
            );
          })}
        </ol>
      </nav>
      <nav
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          "hidden min-h-0 min-w-0 shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-card/40 px-3 py-4 lg:flex lg:w-[220px] xl:w-[240px]",
          className,
        )}
      >
        {groups?.length
          ? groups.map((group) => {
              const groupItems = group.itemIds
                .map((id) => itemById.get(id))
                .filter((item): item is SectionProgressNavItem => Boolean(item));
              return (
                <div key={group.id} className="mb-2 min-w-0">
                  <GroupHeader group={group} />
                  <div className="mt-1 flex flex-col gap-0.5">
                    {renderItems(groupItems, "sidebar")}
                  </div>
                </div>
              );
            })
          : renderItems(items, "sidebar")}
      </nav>
    </>
  );
}
