"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

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
import { useFormDialogGuard } from "@/components/ui/use-form-dialog-guard";
import { cn } from "@/lib/utils";

const MOBILE_SHEET_QUERY = "(max-width: 639px)";

export function useMobileFormSheet(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
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
  onEscapeKeyDown?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  /** When true, enables discard-confirm and double-submit dismiss blocking. */
  enableGuard?: boolean;
  guardPending?: boolean;
  guardFormRef?: RefObject<HTMLFormElement | null>;
  guardDraftFieldNames?: string[];
  onGuardReset?: () => void;
  guardDiscardTestId?: string;
};

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  testId,
  contentClassName,
  onPointerDownOutside: onPointerDownOutsideProp,
  onEscapeKeyDown: onEscapeKeyDownProp,
  onInteractOutside: onInteractOutsideProp,
  enableGuard = false,
  guardPending: guardPendingProp,
  guardFormRef,
  guardDraftFieldNames,
  onGuardReset,
  guardDiscardTestId,
}: ResponsiveFormDialogProps) {
  const mobile = useMobileFormSheet();
  const [guardPendingInternal, setGuardPendingInternal] = useState(false);
  const guardPending = guardPendingProp ?? guardPendingInternal;

  const builtInGuard = useFormDialogGuard({
    open,
    onOpenChange,
    pending: guardPending,
    setPending: setGuardPendingInternal,
    ...(guardFormRef ? { formRef: guardFormRef } : {}),
    ...(guardDraftFieldNames ? { draftFieldNames: guardDraftFieldNames } : {}),
    ...(onGuardReset ? { onReset: onGuardReset } : {}),
    ...(guardDiscardTestId ? { discardTestId: guardDiscardTestId } : {}),
  });

  const useBuiltInGuard = enableGuard;
  const { FormDialogGuardProvider, DiscardConfirmDialog } = builtInGuard;
  const resolvedOnOpenChange = useBuiltInGuard
    ? builtInGuard.guardedOnOpenChange
    : onOpenChange;

  const onPointerDownOutside = useBuiltInGuard
    ? builtInGuard.onPointerDownOutside
    : onPointerDownOutsideProp;
  const onEscapeKeyDown = useBuiltInGuard
    ? builtInGuard.onEscapeKeyDown
    : onEscapeKeyDownProp;
  const onInteractOutside = useBuiltInGuard
    ? builtInGuard.onInteractOutside
    : onInteractOutsideProp;

  const dismissHandlerProps = {
    ...(onPointerDownOutside ? { onPointerDownOutside } : {}),
    ...(onEscapeKeyDown
      ? {
          onEscapeKeyDown: (event: KeyboardEvent) => {
            onEscapeKeyDown(event);
          },
        }
      : {}),
    ...(onInteractOutside ? { onInteractOutside } : {}),
  };

  const shellClassName = cn(
    contentClassName,
    useBuiltInGuard ? builtInGuard.closeButtonClassName : undefined,
  );

  const inner = (
    <>
      {description ? (
        mobile ? (
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        )
      ) : mobile ? (
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
      ) : (
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
      )}
      <div
        className={cn("min-w-0", mobile ? "mt-4" : undefined)}
        {...(useBuiltInGuard ? builtInGuard.contentWrapperProps : {})}
      >
        {children}
      </div>
    </>
  );

  const dialogBody = useBuiltInGuard ? (
    <FormDialogGuardProvider>{inner}</FormDialogGuardProvider>
  ) : (
    inner
  );

  return (
    <>
      {mobile ? (
        <Sheet open={open} onOpenChange={resolvedOnOpenChange}>
          <SheetContent
            side="bottom"
            className={cn(
              "max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-1rem))] gap-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
              shellClassName,
            )}
            data-testid={testId}
            {...dismissHandlerProps}
          >
            {dialogBody}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={resolvedOnOpenChange}>
          <DialogContent
            className={cn("max-w-lg", shellClassName)}
            data-testid={testId}
            {...dismissHandlerProps}
          >
            {dialogBody}
          </DialogContent>
        </Dialog>
      )}
      {useBuiltInGuard ? DiscardConfirmDialog : null}
    </>
  );
}
