"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileDisplayNameForm({
  initialDisplayName,
  onSave,
}: {
  initialDisplayName: string;
  onSave: (displayName: string) => Promise<{ error?: string; ok?: true }>;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!displayName.trim()) {
      setMessage("Enter how you would like your name to appear.");
      setLoading(false);
      return;
    }

    const result = await onSave(displayName.trim());
    setMessage(result.error ?? "Profile updated.");
    setLoading(false);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="profile-display-name-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
        />
        <p className="text-xs text-muted-foreground">
          This name appears in people directories and collaboration features
          across organisations you belong to.
        </p>
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
