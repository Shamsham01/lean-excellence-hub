import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-linear-to-b from-primary to-primary/90 text-primary-foreground shadow-sm hover:from-primary/95 hover:to-primary/85",
        secondary:
          "border-border/60 bg-muted/80 text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "border-transparent hover:bg-accent hover:text-accent-foreground",
        outline:
          "border-border/60 bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        destructive:
          "border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "min-h-9 px-4",
        sm: "min-h-8 px-3 text-xs",
        lg: "min-h-11 px-5",
        icon: "size-9 min-h-9 p-0",
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
