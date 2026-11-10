"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MOBILE_SHEET_QUERY = "(max-width: 639px)";

export function useMobileFormSheet(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_SHEET_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return mobile;
}

export type ResponsiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
  contentClassName?: string;
  onPointerDownOutside?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
};

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  testId,
  contentClassName,
  onPointerDownOutside,
  onEscapeKeyDown,
}: ResponsiveFormDialogProps) {
  const mobile = useMobileFormSheet();
  const describedBy = description ? undefined : undefined;

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-1rem))] gap-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
            contentClassName,
          )}
          data-testid={testId}
          aria-describedby={describedBy}
        >
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="mt-4 min-w-0">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-lg", contentClassName)}
        data-testid={testId}
        aria-describedby={describedBy}
        {...(onPointerDownOutside
          ? { onPointerDownOutside }
          : {})}
        {...(onEscapeKeyDown ? { onEscapeKeyDown } : {})}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
