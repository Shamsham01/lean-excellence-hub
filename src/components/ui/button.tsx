import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

/** Button variants adapted from TailAdmin (MIT — third-party/TAILADMIN-MIT.txt). */

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-primary/20 active:not-disabled:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary text-primary-foreground shadow-[var(--shadow-theme-xs)] hover:bg-primary/90",
        secondary:
          "border-border/60 bg-muted/80 text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "border-transparent hover:bg-accent hover:text-accent-foreground",
        outline:
          "border-border/80 bg-card text-foreground shadow-[var(--shadow-theme-xs)] hover:bg-accent hover:text-accent-foreground",
        destructive:
          "border-destructive/30 bg-destructive text-destructive-foreground shadow-[var(--shadow-theme-xs)] hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2.5 [&_svg]:size-4",
        sm: "h-9 rounded-lg px-3.5 py-2 text-xs [&_svg]:size-3.5",
        lg: "h-11 px-5 py-3 [&_svg]:size-4",
        icon: "size-10 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
