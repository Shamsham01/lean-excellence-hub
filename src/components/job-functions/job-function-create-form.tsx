"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JobFunctionCreateForm({
  onCreate,
}: {
  onCreate: (input: {
    name: string;
    code: string;
    description?: string;
  }) => Promise<{ error?: string; ok?: true }>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!name.trim() || !code.trim()) {
      setMessage("Enter a name and code.");
      setLoading(false);
      return;
    }

    const result = await onCreate({
      name: name.trim(),
      code: code.trim().toLowerCase(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });

    if (result.error) {
      setMessage(result.error);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setMessage("Job function created.");
    }
    setLoading(false);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="job-function-create-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="jf-name">Name</Label>
          <Input
            id="jf-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Production operator"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="jf-code">Code</Label>
          <Input
            id="jf-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="production-operator"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="jf-description">Description (optional)</Label>
        <Input
          id="jf-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create job function"}
      </Button>
    </form>
  );
}
