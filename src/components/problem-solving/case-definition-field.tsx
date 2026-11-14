"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CaseDefinitionFieldProps = {
  label: string;
  value: string | null;
  placeholder: string;
  maxLength: number;
  testId: string;
  canEdit: boolean;
  onSave: (nextValue: string) => Promise<{ error?: string }>;
};

export function CaseDefinitionField({
  label,
  value,
  placeholder,
  maxLength,
  testId,
  canEdit,
  onSave,
}: CaseDefinitionFieldProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = value?.trim() ? value : "—";

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError(`${label} is required`);
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Keep ${label.toLowerCase()} within ${maxLength} characters`);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await onSave(trimmed);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        {canEdit && !editing ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            data-testid={`${testId}-edit`}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={loading}
            data-testid={`${testId}-input`}
            aria-label={label}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleSave}
              data-testid={`${testId}-save`}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={handleCancel}
              data-testid={`${testId}-cancel`}
            >
              Cancel
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">{display}</p>
      )}
    </div>
  );
}