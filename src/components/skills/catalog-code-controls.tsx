"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CatalogCodeControls({
  noun,
  autoCode,
  useCustomCode,
  customCode,
  disabled,
  onToggle,
  onCustomCodeChange,
  previewTestId,
  toggleTestId,
  inputTestId,
}: {
  noun: string;
  autoCode: string;
  useCustomCode: boolean;
  customCode: string;
  disabled: boolean;
  onToggle: () => void;
  onCustomCodeChange: (value: string) => void;
  previewTestId: string;
  toggleTestId: string;
  inputTestId: string;
}) {
  return (
    <>
      {!useCustomCode ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={previewTestId}
        >
          Code:{" "}
          <span className="font-medium text-foreground">
            {autoCode || "Enter a name to suggest a code"}
          </span>
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto self-start px-0 text-primary underline-offset-4 hover:underline"
        disabled={disabled}
        onClick={onToggle}
        data-testid={toggleTestId}
      >
        {useCustomCode ? "Use suggested code" : "Edit code"}
      </Button>
      {useCustomCode ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={inputTestId}>{noun} code</Label>
          <Input
            id={inputTestId}
            name="code"
            required
            value={customCode}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${inputTestId}-hint`}
            onChange={(event) => onCustomCodeChange(event.target.value)}
            data-testid={inputTestId}
          />
          <p
            id={`${inputTestId}-hint`}
            className="text-xs text-muted-foreground"
          >
            Lowercase letters, numbers, dots, hyphens, or underscores. Start
            with a letter or number. The name stays the primary label.
          </p>
        </div>
      ) : null}
    </>
  );
}
