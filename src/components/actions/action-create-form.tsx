"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createAction } from "@/app/(platform)/platform/actions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ActionCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createAction(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      router.push(`/platform/actions/${result.id}`);
      router.refresh();
    }
  }

  return (
    <Card data-testid="actions-create-form">
      <CardHeader>
        <CardTitle>Create action</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex max-w-lg flex-col gap-4">
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
      </CardContent>
    </Card>
  );
}
