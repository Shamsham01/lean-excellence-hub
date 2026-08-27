"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { awardRecognition } from "@/app/(platform)/platform/recognition/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecognitionType = { id: string; name: string };

type AwardRecognitionFormProps = {
  types: RecognitionType[];
  organisationalUnitId: string;
  defaultRecipientId?: string;
  defaultSourceId?: string;
};

export function AwardRecognitionForm({
  types,
  organisationalUnitId,
  defaultRecipientId,
  defaultSourceId,
}: AwardRecognitionFormProps) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientId, setRecipientId] = useState(defaultRecipientId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await awardRecognition({
        recognitionTypeId: typeId,
        title,
        message,
        organisationalUnitId,
        visibility: "unit",
        recipientMembershipIds: [recipientId],
        ...(defaultSourceId ? { sourceResourceId: defaultSourceId } : {}),
      });
      if (result.error) throw new Error(result.error);
      router.push("/platform/recognition");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Award failed");
    }
  }

  return (
    <Card data-testid="award-recognition-form">
      <CardHeader>
        <CardTitle>Award recognition</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Recognition type</span>
            <select
              className="border-input rounded-md border px-3 py-2"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Title</span>
            <input
              required
              className="border-input rounded-md border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Message</span>
            <textarea
              required
              rows={3}
              className="border-input rounded-md border px-3 py-2"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Recipient membership ID</span>
            <input
              required
              className="border-input rounded-md border px-3 py-2"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="min-h-11">
            Award
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
