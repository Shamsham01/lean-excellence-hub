"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

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

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        router.refresh();
        onSuccess?.();
      }}
      className={className}
    >
      {children}
    </form>
  );
}
