"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

import { useFormDialogGuardReporter } from "@/components/ui/use-form-dialog-guard";

export function DialogServerActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
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
          onSuccess?.();
          router.refresh();
        } finally {
          guard?.setPending(false);
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
