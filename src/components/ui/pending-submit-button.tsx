"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

export const PendingSubmitButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, disabled, ...props }, ref) => {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled || pending}
      aria-busy={pending || props["aria-busy"]}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
});
PendingSubmitButton.displayName = "PendingSubmitButton";
