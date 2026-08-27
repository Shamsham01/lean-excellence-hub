"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";

import { revokeRecognition } from "@/app/(platform)/platform/recognition/actions";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

type RecognitionAward = {
  id: string;

  title: string;

  message: string;

  recognition_type_name: string;

  awarded_at: string;

  status: string;
};

type RecognitionHistoryProps = {
  awards: RecognitionAward[];

  canManage: boolean;
};

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return "Revoke failed";
}

export function RecognitionHistory({
  awards,
  canManage,
}: RecognitionHistoryProps) {
  const router = useRouter();

  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [reason, setReason] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleRevoke(awardId: string) {
    if (!reason.trim()) {
      setError("A reason is required to revoke recognition");

      return;
    }

    setLoading(true);

    setError(null);

    try {
      const result = await revokeRecognition(awardId, reason.trim());

      if (result.error) throw new Error(result.error);

      setRevokingId(null);

      setReason("");

      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (awards.length === 0) {
    return (
      <Card data-testid="recognition-history">
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          No recognition awards yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="recognition-history">
      <CardHeader>
        <CardTitle className="text-base">History</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {awards.map((award) => (
          <div
            key={award.id}
            className="rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{award.title}</p>

                <p className="mt-1 text-muted-foreground">{award.message}</p>

                <p className="mt-2 text-xs text-muted-foreground">
                  {award.recognition_type_name} ·{" "}
                  {new Date(award.awarded_at).toLocaleString("en-GB")}
                </p>
              </div>

              <Badge
                variant={award.status === "active" ? "secondary" : "outline"}
              >
                {award.status}
              </Badge>
            </div>

            {canManage && award.status === "active" ? (
              <div className="mt-3 flex flex-col gap-2">
                {revokingId === award.id ? (
                  <>
                    <label className="flex flex-col gap-1">
                      <Label htmlFor={`revoke-reason-${award.id}`}>
                        Revocation reason
                      </Label>

                      <Textarea
                        id={`revoke-reason-${award.id}`}

                        rows={2}

                        value={reason}

                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>

                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}

                    <div className="flex gap-2">
                      <Button
                        size="sm"

                        variant="destructive"

                        disabled={loading}

                        onClick={() => handleRevoke(award.id)}
                      >
                        Confirm revoke
                      </Button>

                      <Button
                        size="sm"

                        variant="outline"

                        disabled={loading}

                        onClick={() => {
                          setRevokingId(null);

                          setReason("");

                          setError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    size="sm"

                    variant="outline"

                    className="self-start"

                    onClick={() => setRevokingId(award.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
