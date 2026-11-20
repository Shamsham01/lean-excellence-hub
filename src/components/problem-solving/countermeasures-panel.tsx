"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createCountermeasure,
  linkCountermeasureCauses,
  selectCountermeasure,
} from "@/app/(platform)/platform/problem-solving/actions";
import { ProblemSolvingActionDialog } from "@/components/problem-solving/problem-solving-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countermeasureStatusLabel } from "@/lib/problem-solving/effectiveness";
import { AppLink } from "@/components/ui/app-link";
import { actionStatusLabel } from "@/lib/actions/status";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type CountermeasuresPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canContribute: boolean;
  canManage: boolean;
  defaultAssigneeMembershipId?: string | null;
};

export function CountermeasuresPanel({
  caseId,
  detail,
  canContribute,
  canManage,
  defaultAssigneeMembershipId,
}: CountermeasuresPanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCauseIds, setSelectedCauseIds] = useState<
    Record<string, string>
  >({});
  const [actionDialogFor, setActionDialogFor] = useState<string | null>(null);
  const [actionDefaultTitle, setActionDefaultTitle] = useState("");
  const [raiseAnotherFor, setRaiseAnotherFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const verifiedHypotheses = detail.hypotheses.filter(
    (row) => row.status === "verified",
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const result = await createCountermeasure({
      caseId,
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    setMessage(result.error ?? "Countermeasure created");
    setTitle("");
    setDescription("");
    setLoading(false);
    router.refresh();
  }

  async function handleSelect(countermeasureId: string) {
    setLoading(true);
    const causeId = selectedCauseIds[countermeasureId];
    if (causeId) {
      await linkCountermeasureCauses(countermeasureId, caseId, [causeId]);
    }
    const result = await selectCountermeasure(
      countermeasureId,
      caseId,
      "Selected from workspace",
    );
    setMessage(result.error ?? "Countermeasure selected");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-countermeasures-panel"
    >
      {canContribute ? (
        <Card>
          <CardHeader>
            <CardTitle>Propose countermeasure</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Title</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="countermeasure-title"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Description</span>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <Button type="submit" size="sm" disabled={loading}>
                Create countermeasure
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Countermeasures ({detail.countermeasures.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.countermeasures.length === 0 ? (
            <p className="text-muted-foreground">No countermeasures yet.</p>
          ) : (
            detail.countermeasures.map((item) => {
              const linkedActions = detail.actions.filter(
                (action) => action.countermeasure_id === item.id,
              );
              const primaryLinked = linkedActions[0];
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-md border border-border px-3 py-2"
                  data-testid={`countermeasure-item-${item.id}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge variant="outline" className="mb-1">
                        {countermeasureStatusLabel(item.status)}
                      </Badge>
                      <p className="font-medium">{item.title}</p>
                      {item.description ? (
                        <p className="text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      {item.cause_links.length > 0 ? (
                        <p
                          className="mt-1 text-xs text-muted-foreground"
                          data-testid={`countermeasure-causes-${item.id}`}
                        >
                          Linked causes:{" "}
                          {item.cause_links
                            .map(
                              (link) =>
                                link.hypothesis_statement ??
                                link.hypothesis_id.slice(0, 8),
                            )
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {canManage && item.status === "proposed" ? (
                      <div className="flex flex-col gap-2">
                        <select
                          className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-xs"
                          value={selectedCauseIds[item.id] ?? ""}
                          onChange={(e) =>
                            setSelectedCauseIds((current) => ({
                              ...current,
                              [item.id]: e.target.value,
                            }))
                          }
                          data-testid={`countermeasure-cause-select-${item.id}`}
                        >
                          <option value="">Select verified cause</option>
                          {verifiedHypotheses.map((hypothesis) => (
                            <option key={hypothesis.id} value={hypothesis.id}>
                              {hypothesis.statement.slice(0, 60)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => handleSelect(item.id)}
                          data-testid={`select-countermeasure-${item.id}`}
                        >
                          Select
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {canManage &&
                  [
                    "selected",
                    "implementing",
                    "implemented",
                    "effective",
                  ].includes(item.status) ? (
                    <div className="border-t border-border pt-2">
                      {primaryLinked && raiseAnotherFor !== item.id ? (
                        <div className="flex flex-col gap-2 text-sm">
                          <AppLink
                            href={`/platform/actions/${primaryLinked.id}`}
                            className="font-medium hover:underline"
                            data-testid={`countermeasure-linked-action-${item.id}`}
                          >
                            {primaryLinked.title} ·{" "}
                            {actionStatusLabel(primaryLinked.status)}
                          </AppLink>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => setRaiseAnotherFor(item.id)}
                            data-testid={`countermeasure-raise-another-${item.id}`}
                          >
                            Raise another
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => {
                            setActionDefaultTitle(`Implement: ${item.title}`);
                            setActionDialogFor(item.id);
                            setRaiseAnotherFor(null);
                          }}
                          data-testid={`link-countermeasure-action-${item.id}`}
                        >
                          Raise action
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      <ProblemSolvingActionDialog
        key={actionDialogFor ?? "closed"}
        open={actionDialogFor != null}
        onOpenChange={(next) => {
          if (!next) setActionDialogFor(null);
        }}
        caseId={caseId}
        contextRole="countermeasure"
        countermeasureId={actionDialogFor}
        defaultTitle={actionDefaultTitle}
        defaultMembershipId={defaultAssigneeMembershipId ?? null}
        onCreated={() => {
          setMessage("Countermeasure action linked");
          router.refresh();
        }}
      />
    </div>
  );
}
