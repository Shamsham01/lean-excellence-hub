"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";

import { createRecognitionType } from "@/app/(platform)/platform/recognition/actions";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

type RecognitionType = {
  id: string;

  name: string;

  code: string;

  description: string | null;

  status: string;
};

type RecognitionTypeManagementProps = {
  types: RecognitionType[];
};

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return "Could not create recognition type";
}

export function RecognitionTypeManagement({
  types,
}: RecognitionTypeManagementProps) {
  const router = useRouter();

  const [name, setName] = useState("");

  const [code, setCode] = useState("");

  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);

    setError(null);

    try {
      const result = await createRecognitionType({
        name,

        code,

        ...(description ? { description } : {}),
      });

      if (result.error) throw new Error(result.error);

      setName("");

      setCode("");

      setDescription("");

      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="recognition-type-management"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create recognition type</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="type-name">Name</Label>

              <Input
                id="type-name"

                required

                value={name}

                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="type-code">Code</Label>

              <Input
                id="type-code"

                required

                value={code}

                onChange={(event) => setCode(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="type-description">Description</Label>

              <Textarea
                id="type-description"

                rows={2}

                value={description}

                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="self-start"
            >
              Create type
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {types.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <CardTitle className="text-base">{type.name}</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
              <p>{type.code}</p>

              {type.description ? <p>{type.description}</p> : null}

              <p className="text-xs capitalize">{type.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
