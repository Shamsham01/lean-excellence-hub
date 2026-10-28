"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";

import { dialogVisibleFrame } from "@/components/ui/dialog-viewport";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const DIALOG_SHELL_CLASS =
  "fixed z-50 mx-auto flex w-auto max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg top-[max(1rem,env(safe-area-inset-top,0px))] left-[max(1rem,env(safe-area-inset-left,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)]";

function readSafeAreaInset(edge: "top" | "bottom"): number {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = `env(safe-area-inset-${edge}, 0px)`;
  document.documentElement.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return value;
}

export function DialogContent({
  className,
  children,
  style,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  const frameKey = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);
  const [frameStyle, setFrameStyle] = useState<CSSProperties | null>(null);

  // Radix mounts the dialog node only while it is open, so a mount effect on
  // this component runs before the node exists. The callback ref binds when
  // the open dialog is actually in the document.
  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node) {
      frameKey.current = "";
      return;
    }

    const viewport = window.visualViewport;
    const sync = () => {
      const scroller = node.querySelector<HTMLElement>("[data-dialog-scroll]");
      const frame = dialogVisibleFrame({
        visualHeight: viewport?.height ?? window.innerHeight,
        visualOffsetTop: viewport?.offsetTop ?? 0,
        safeAreaTop: readSafeAreaInset("top"),
        safeAreaBottom: readSafeAreaInset("bottom"),
      });
      const maxHeight = `${frame.maxHeight}px`;
      // A definite height lets the inner region scroll. Short dialogs stay
      // at height:auto so they remain content-sized. Position is set without
      // a transform: a translated dialog does not receive wheel scrolling.
      const tooTall =
        scroller != null && scroller.scrollHeight > frame.maxHeight + 1;
      const height = tooTall ? maxHeight : "auto";
      node.style.maxHeight = maxHeight;
      node.style.height = height;
      const usedHeight = node.offsetHeight;
      const top = `${Math.max(0, frame.top - usedHeight / 2)}px`;
      const key = `${maxHeight}|${top}|${height}`;
      if (key === frameKey.current) {
        return;
      }
      frameKey.current = key;
      setFrameStyle({ maxHeight, top, height });
    };

    const onWheel = (event: WheelEvent) => {
      const scroller = node.querySelector<HTMLElement>("[data-dialog-scroll]");
      if (!scroller || event.deltaY === 0) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 0) {
        return;
      }
      const next = Math.min(
        maxScroll,
        Math.max(0, scroller.scrollTop + event.deltaY),
      );
      if (next === scroller.scrollTop) {
        return;
      }
      scroller.scrollTop = next;
      event.preventDefault();
    };

    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    node.addEventListener("wheel", onWheel, { passive: false });
    const measured = node.querySelector(
      "[data-dialog-scroll]",
    )?.firstElementChild;
    const observer =
      measured && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(sync)
        : null;
    if (measured && observer) {
      observer.observe(measured);
    }
    cleanupRef.current = () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      node.removeEventListener("wheel", onWheel);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-hidden overscroll-contain bg-foreground/40" />
      <DialogPrimitive.Content
        {...props}
        ref={setContentNode}
        className={cn(DIALOG_SHELL_CLASS, className)}
        style={{ ...frameStyle, ...style }}
      >
        <div
          data-dialog-scroll=""
          className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain py-6 pr-14 pl-6"
        >
          <div className="grid min-w-0 gap-4">{children}</div>
        </div>
        <DialogPrimitive.Close
          className="absolute top-3 right-3 z-10 rounded-md bg-card p-2 opacity-70 hover:bg-muted hover:opacity-100"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
