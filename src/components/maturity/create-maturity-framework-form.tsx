"use client";

import { useState } from "react";

import { createMaturityModel } from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

export function CreateMaturityFrameworkForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createMaturityModel(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.modelId) {
        router.push(`/platform/maturity/models/${result.modelId}`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Lean Excellence Framework"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Creating draft…" : "Create draft framework"}
      </Button>
    </form>
  );
}
