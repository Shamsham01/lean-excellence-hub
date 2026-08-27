"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createContainment,
  createProblemSolvingAction,
  releaseContainment,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { containmentStatusLabel } from "@/lib/problem-solving/effectiveness";
import type { ProblemSolvingContainment } from "@/lib/problem-solving/types";

type ContainmentPanelProps = {
  caseId: string;
  containments: ProblemSolvingContainment[];
  canContribute: boolean;
};

export function ContainmentPanel({
  caseId,
  containments,
  canContribute,
}: ContainmentPanelProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [actionTitles, setActionTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    const result = await createContainment({
      caseId,
      description: description.trim(),
      ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
    });
    setMessage(result.error ?? "Containment created");
    setDescription("");
    setRationale("");
    setLoading(false);
    router.refresh();
  }

  async function handleRelease(containmentId: string) {
    setLoading(true);
    const result = await releaseContainment(
      containmentId,
      caseId,
      "Released from workspace",
    );
    setMessage(result.error ?? "Containment released");
    setLoading(false);
    router.refresh();
  }

  async function handleLinkAction(containmentId: string) {
    const title = actionTitles[containmentId]?.trim();
    if (!title) return;
    setLoading(true);
    const result = await createProblemSolvingAction({
      caseId,
      title,
      contextRole: "containment",
      containmentId,
      description: "Containment follow-up action",
    });
    setMessage(result.error ?? "Containment action linked");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-containment-panel"
    >
      {canContribute ? (
        <Card>
          <CardHeader>
            <CardTitle>Add containment action</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Description</span>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="containment-description"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Rationale</span>
                <Input
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                />
              </label>
              <Button type="submit" size="sm" disabled={loading}>
                Create containment
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Containment actions ({containments.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {containments.length === 0 ? (
            <p className="text-muted-foreground">No containment actions yet.</p>
          ) : (
            containments.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2"
                data-testid={`containment-item-${item.id}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {containmentStatusLabel(item.status)}
                    </Badge>
                    <p>{item.description}</p>
                    {item.rationale ? (
                      <p className="text-xs text-muted-foreground">
                        {item.rationale}
                      </p>
                    ) : null}
                  </div>
                  {canContribute && item.status !== "released" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => handleRelease(item.id)}
                    >
                      Release
                    </Button>
                  ) : null}
                </div>
                {canContribute ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-2 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-xs">
                      <span>Universal action for this containment</span>
                      <Input
                        value={actionTitles[item.id] ?? ""}
                        onChange={(e) =>
                          setActionTitles((current) => ({
                            ...current,
                            [item.id]: e.target.value,
                          }))
                        }
                        data-testid={`containment-action-title-${item.id}`}
                        placeholder="Action title"
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={() => handleLinkAction(item.id)}
                      data-testid={`link-containment-action-${item.id}`}
                    >
                      Link action
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
