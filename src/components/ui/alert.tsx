import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full gap-1 rounded-xl border px-3 py-2.5 text-sm has-[>[data-slot=alert-icon]]:grid-cols-[auto_1fr] has-[>[data-slot=alert-icon]]:gap-x-2.5",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/40 text-foreground",
        success:
          "border-success/40 bg-success/10 text-success [&_[data-slot=alert-icon]]:text-success",
        warning:
          "border-warning/40 bg-warning/10 text-warning [&_[data-slot=alert-icon]]:text-warning",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive [&_[data-slot=alert-icon]]:text-destructive",
        info: "border-information/40 bg-information/10 text-information [&_[data-slot=alert-icon]]:text-information",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    icon?: ReactNode;
    title?: ReactNode;
  };

export function Alert({
  className,
  variant,
  icon,
  title,
  children,
  role = "alert",
  ...props
}: AlertProps) {
  return (
    <div
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon ? (
        <span data-slot="alert-icon" className="row-span-2 pt-0.5">
          {icon}
        </span>
      ) : null}
      {title ? (
        <p className="col-start-2 font-medium text-foreground">{title}</p>
      ) : null}
      <div
        className={cn(
          "text-sm text-balance [&_p]:text-inherit",
          title ? "col-start-2" : icon ? "col-start-2" : undefined,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export type InlineAlertTone = "success" | "warning" | "error" | "info";

const toneToVariant: Record<
  InlineAlertTone,
  NonNullable<VariantProps<typeof alertVariants>["variant"]>
> = {
  success: "success",
  warning: "warning",
  error: "destructive",
  info: "info",
};

export function InlineAlert({
  tone,
  children,
  className,
  testId,
  role,
}: {
  tone: InlineAlertTone;
  children: ReactNode;
  className?: string;
  testId?: string;
  role?: "alert" | "status";
}) {
  return (
    <Alert
      variant={toneToVariant[tone]}
      className={className}
      data-testid={testId}
      role={role ?? (tone === "error" ? "alert" : "status")}
    >
      {children}
    </Alert>
  );
}
