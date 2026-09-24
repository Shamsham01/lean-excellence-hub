"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type UIEvent,
} from "react";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

function updateTabOverflow(
  element: HTMLElement,
  setOverflow: (value: { start: boolean; end: boolean }) => void,
) {
  const start = element.scrollLeft > 1;
  const end =
    element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
  setOverflow({ start, end });
}

export function TabsList({
  className,
  children,
  onScroll,
  onFocusCapture,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = listRef.current;
    if (element) {
      updateTabOverflow(element, setOverflow);
    }
  }, []);

  useEffect(() => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [measure, children]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    updateTabOverflow(event.currentTarget, setOverflow);
    onScroll?.(event);
  }

  function handleFocusCapture(event: FocusEvent<HTMLDivElement>) {
    const tab = (event.target as HTMLElement).closest<HTMLElement>(
      '[role="tab"]',
    );
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    onFocusCapture?.(event);
  }

  return (
    <div className="relative max-w-full min-w-0">
      <TabsPrimitive.List
        ref={listRef}
        data-testid="shared-tabs-list"
        data-overflow-start={overflow.start ? "true" : "false"}
        data-overflow-end={overflow.end ? "true" : "false"}
        className={cn(
          "tabs-scroll flex min-h-10 w-full max-w-full min-w-0 items-center justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-muted/40 p-1 pb-1.5",
          className,
        )}
        onScroll={handleScroll}
        onFocusCapture={handleFocusCapture}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
      {overflow.start ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 w-8 rounded-l-md bg-linear-to-r from-muted to-transparent"
        />
      ) : null}
      {overflow.end ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-1 right-1 w-8 rounded-r-md bg-linear-to-l from-muted to-transparent"
        />
      ) : null}
      {overflow.start || overflow.end ? (
        <p className="sr-only">
          More tabs available. Scroll horizontally or use arrow keys to reach
          every tab.
        </p>
      ) : null}
    </div>
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
