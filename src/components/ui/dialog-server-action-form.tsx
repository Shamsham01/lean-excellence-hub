"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

import { useFormDialogGuardReporter } from "@/components/ui/use-form-dialog-guard";

export function DialogServerActionForm({
  action,
  children,
  className,
  onSuccess,
  onError,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useFormDialogGuardReporter();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        guard?.setPending(true);
        try {
          await action(formData);
          formRef.current?.reset();
          guard?.setPending(false);
          onSuccess?.();
          queueMicrotask(() => {
            router.refresh();
          });
        } catch (error) {
          guard?.setPending(false);
          if (onError) {
            onError(error);
            return;
          }
          throw error;
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
