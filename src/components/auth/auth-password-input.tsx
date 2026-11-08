"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { InputHTMLAttributes } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthPasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export function AuthPasswordInput({
  className,
  id,
  ...props
}: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? props.name ?? "password";

  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        className="pe-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 size-9 min-h-9 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide characters" : "Reveal characters"}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
