"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type RadioGroupContextValue = {
  name: string;
  value: string;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function RadioGroup({
  name: nameProp,
  value,
  onValueChange,
  disabled,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const name = nameProp ?? autoId;

  const contextValue: RadioGroupContextValue = { name, value };
  if (onValueChange) contextValue.onValueChange = onValueChange;
  if (disabled !== undefined) contextValue.disabled = disabled;

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn("flex flex-col gap-2", className)}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export const RadioGroupItem = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { value: string }
>(({ className, value: itemValue, id, children, ...props }, ref) => {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error("RadioGroupItem must be used within RadioGroup");
  }

  const checked = ctx.value === itemValue;
  const inputId = id ?? `${ctx.name}-${itemValue}`;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm text-foreground",
        (ctx.disabled || props.disabled) && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={ref}
        type="radio"
        id={inputId}
        name={ctx.name}
        value={itemValue}
        checked={checked}
        disabled={ctx.disabled || props.disabled}
        className="size-4 accent-[var(--primary)]"
        onChange={() => ctx.onValueChange?.(itemValue)}
        {...props}
      />
      {children}
    </label>
  );
});
RadioGroupItem.displayName = "RadioGroupItem";
