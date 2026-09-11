"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { awardRecognition } from "@/app/(platform)/platform/recognition/actions";
import { OrganisationalUnitSelect } from "@/components/organisation/organisational-unit-select";
import { PersonSelect } from "@/components/people/person-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PersonSelectOption,
  UnitSelectOption,
} from "@/modules/organisation/site-context";

type RecognitionType = { id: string; name: string };

type AwardRecognitionFormProps = {
  types: RecognitionType[];
  units: UnitSelectOption[];
  people: PersonSelectOption[];
  requiresSiteSelection?: boolean;
  defaultUnitId?: string;
  defaultRecipientId?: string;
  defaultSourceId?: string;
};

export function AwardRecognitionForm({
  types,
  units,
  people,
  requiresSiteSelection = false,
  defaultUnitId,
  defaultRecipientId,
  defaultSourceId,
}: AwardRecognitionFormProps) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [unitId, setUnitId] = useState(defaultUnitId ?? units[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(
    defaultRecipientId ?? people[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!unitId || !recipientId) {
      setError("Choose an organisational unit and recipient.");
      return;
    }
    try {
      const result = await awardRecognition({
        recognitionTypeId: typeId,
        title,
        message,
        organisationalUnitId: unitId,
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
          <OrganisationalUnitSelect
            label="Organisation unit"
            options={units}
            value={unitId}
            onChange={setUnitId}
            required
            requiresSiteSelection={requiresSiteSelection}
            testId="recognition-unit-select"
          />
          <PersonSelect
            label="Recipient"
            options={people}
            value={recipientId}
            onChange={setRecipientId}
            required
            requiresSiteSelection={requiresSiteSelection}
            testId="recognition-recipient-select"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="min-h-11">
            Award
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
