"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createContainment,
  releaseContainment,
} from "@/app/(platform)/platform/problem-solving/actions";
import { ProblemSolvingActionDialog } from "@/components/problem-solving/problem-solving-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { containmentStatusLabel } from "@/lib/problem-solving/effectiveness";
import type { ProblemSolvingContainment } from "@/lib/problem-solving/types";

type ContainmentPanelProps = {
  caseId: string;
  siteUnitId?: string | null;
  containments: ProblemSolvingContainment[];
  canContribute: boolean;
  defaultAssigneeMembershipId?: string | null;
};

export function ContainmentPanel({
  caseId,
  siteUnitId = null,
  containments,
  canContribute,
  defaultAssigneeMembershipId,
}: ContainmentPanelProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [actionDialogFor, setActionDialogFor] = useState<string | null>(null);
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
                  <div className="border-t border-border pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActionDialogFor(item.id)}
                      data-testid={`link-containment-action-${item.id}`}
                    >
                      Raise action
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
      <ProblemSolvingActionDialog
        key={actionDialogFor ?? "closed"}
        open={actionDialogFor != null}
        onOpenChange={(open) => {
          if (!open) setActionDialogFor(null);
        }}
        caseId={caseId}
        siteUnitId={siteUnitId}
        contextRole="containment"
        containmentId={actionDialogFor}
        defaultTitle="Containment follow-up"
        defaultMembershipId={defaultAssigneeMembershipId ?? null}
        onCreated={() => {
          setMessage("Containment action linked");
          router.refresh();
        }}
      />
    </div>
  );
}
