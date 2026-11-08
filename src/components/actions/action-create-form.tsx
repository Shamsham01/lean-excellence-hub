"use client";

import { useRef, useState } from "react";

import { createAction } from "@/app/(platform)/platform/actions/actions";
import { RelatedRecordsPanel } from "@/components/improvement/related-records-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";

export function ActionCreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function syncQueryFromForm() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setQueryText(
      `${String(formData.get("title") ?? "")} ${String(formData.get("description") ?? "")}`.trim(),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await createAction(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      navigateTo(`/platform/actions/${result.id}`);
    }
  }

  return (
    <Card id="actions-create-form" data-testid="actions-create-form">
      <CardHeader>
        <CardTitle>Create action</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onInput={syncQueryFromForm}
          className="flex max-w-lg flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Action title"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create action"}
          </Button>
        </form>

        <RelatedRecordsPanel
          recordType="action"
          queryText={queryText}
          resolveQuery={() => {
            if (typeof document !== "undefined") {
              const titleInput = document.getElementById(
                "title",
              ) as HTMLInputElement | null;
              const descriptionInput = document.getElementById(
                "description",
              ) as HTMLTextAreaElement | null;
              const fromDom =
                `${titleInput?.value ?? ""} ${descriptionInput?.value ?? ""}`.trim();
              if (fromDom) return fromDom;
            }
            if (!formRef.current) return queryText;
            const formData = new FormData(formRef.current);
            return `${String(formData.get("title") ?? "")} ${String(formData.get("description") ?? "")}`.trim();
          }}
          disabled={pending}
        />
      </CardContent>
    </Card>
  );
}
