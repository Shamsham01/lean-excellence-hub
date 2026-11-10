"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FormDialogGuardContextValue = {
  setPending: (pending: boolean) => void;
  registerForm: (form: HTMLFormElement | null) => void;
};

const FormDialogGuardContext =
  createContext<FormDialogGuardContextValue | null>(null);

export function useFormDialogGuardReporter() {
  return useContext(FormDialogGuardContext);
}

function editableFieldNames(form: HTMLFormElement): string[] {
  const names: string[] = [];
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLElement)) continue;
    if (element instanceof HTMLInputElement) {
      if (
        element.type === "hidden" ||
        element.type === "submit" ||
        element.type === "button"
      ) {
        continue;
      }
      if (element.name) names.push(element.name);
    } else if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      if (element.name) names.push(element.name);
    }
  }
  return names;
}

export function formHasUserDraft(
  form: HTMLFormElement | null,
  fieldNames?: string[],
): boolean {
  if (!form) return false;
  const names = fieldNames ?? editableFieldNames(form);
  const formData = new FormData(form);
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string" && value.trim()) return true;
    if (value instanceof File && value.size > 0) return true;
  }
  return false;
}

export type UseFormDialogGuardOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  setPending?: (pending: boolean) => void;
  formRef?: RefObject<HTMLFormElement | null>;
  draftFieldNames?: string[];
  onReset?: () => void;
  discardTestId?: string;
};

export function useFormDialogGuard({
  open,
  onOpenChange,
  pending,
  setPending,
  formRef,
  draftFieldNames,
  onReset,
  discardTestId = "form-dialog-discard-confirm",
}: UseFormDialogGuardOptions) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const resolveForm = useCallback(() => {
    return (
      formRef?.current ??
      contentRef.current?.querySelector("form") ??
      null
    );
  }, [formRef]);

  const hasDraft = useCallback(() => {
    return formHasUserDraft(resolveForm(), draftFieldNames);
  }, [draftFieldNames, resolveForm]);

  const resetForm = useCallback(() => {
    resolveForm()?.reset();
    onReset?.();
    setDiscardConfirmOpen(false);
  }, [onReset, resolveForm]);

  const closeAndReset = useCallback(() => {
    setDiscardConfirmOpen(false);
    onOpenChange(false);
    resetForm();
  }, [onOpenChange, resetForm]);

  const requestDismiss = useCallback(() => {
    if (pending) return;
    if (!hasDraft()) {
      closeAndReset();
      return;
    }
    setDiscardConfirmOpen(true);
  }, [closeAndReset, hasDraft, pending]);

  const guardDismiss = useCallback(
    (event: Event) => {
      if (pending) {
        event.preventDefault();
        return;
      }
      if (hasDraft()) {
        event.preventDefault();
        setDiscardConfirmOpen(true);
      }
    },
    [hasDraft, pending],
  );

  const guardedOnOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      requestDismiss();
    },
    [onOpenChange, requestDismiss],
  );

  const reportPending = useCallback(
    (value: boolean) => {
      setPending?.(value);
    },
    [setPending],
  );

  const confirmDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    closeAndReset();
  }, [closeAndReset]);

  const DiscardConfirmDialog = (
    <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
      <DialogContent
        data-testid="form-dialog-discard-dialog"
        className="max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Discard draft?</DialogTitle>
          <DialogDescription>
            Your changes will be cleared. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDiscardConfirmOpen(false)}
          >
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirmDiscard}
            data-testid={discardTestId}
          >
            Discard draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const guardContextValue: FormDialogGuardContextValue = {
    setPending: reportPending,
    registerForm: () => {},
  };

  const contentWrapperProps = {
    ref: contentRef,
  };

  const closeButtonClassName = cn(
    pending &&
      "[&_button[aria-label='Close']]:pointer-events-none [&_button[aria-label='Close']]:opacity-40",
  );

  return {
    guardedOnOpenChange,
    onPointerDownOutside: guardDismiss,
    onEscapeKeyDown: guardDismiss,
    onInteractOutside: guardDismiss,
    requestDismiss,
    DiscardConfirmDialog,
    FormDialogGuardProvider: ({ children }: { children: ReactNode }) => (
      <FormDialogGuardContext.Provider value={guardContextValue}>
        {children}
      </FormDialogGuardContext.Provider>
    ),
    contentWrapperProps,
    closeButtonClassName,
  };
}
