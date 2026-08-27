"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createCountermeasure,
  createProblemSolvingAction,
  linkCountermeasureCauses,
  selectCountermeasure,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countermeasureStatusLabel } from "@/lib/problem-solving/effectiveness";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type CountermeasuresPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canContribute: boolean;
  canManage: boolean;
};

export function CountermeasuresPanel({
  caseId,
  detail,
  canContribute,
  canManage,
}: CountermeasuresPanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCauseIds, setSelectedCauseIds] = useState<Record<string, string>>({});
  const [actionTitles, setActionTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const verifiedHypotheses = detail.hypotheses.filter((row) => row.status === "verified");

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
    const result = await selectCountermeasure(countermeasureId, caseId, "Selected from workspace");
    setMessage(result.error ?? "Countermeasure selected");
    setLoading(false);
    router.refresh();
  }

  async function handleLinkAction(countermeasureId: string) {
    const actionTitle = actionTitles[countermeasureId]?.trim();
    if (!actionTitle) return;
    setLoading(true);
    const result = await createProblemSolvingAction({
      caseId,
      title: actionTitle,
      contextRole: "countermeasure",
      countermeasureId,
      description: "Countermeasure implementation action",
    });
    setMessage(result.error ?? "Countermeasure action linked");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="problem-solving-countermeasures-panel">
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
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <CardTitle>Countermeasures ({detail.countermeasures.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.countermeasures.length === 0 ? (
            <p className="text-muted-foreground">No countermeasures yet.</p>
          ) : (
            detail.countermeasures.map((item) => (
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
                      <p className="text-muted-foreground">{item.description}</p>
                    ) : null}
                    {item.cause_links.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground" data-testid={`countermeasure-causes-${item.id}`}>
                        Linked causes:{" "}
                        {item.cause_links
                          .map((link) => link.hypothesis_statement ?? link.hypothesis_id.slice(0, 8))
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {canManage && item.status === "proposed" ? (
                    <div className="flex flex-col gap-2">
                      <select
                        className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-xs"
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
                {canManage && ["selected", "implementing", "implemented", "effective"].includes(item.status) ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-2 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-xs">
                      <span>Universal action for this countermeasure</span>
                      <Input
                        value={actionTitles[item.id] ?? ""}
                        onChange={(e) =>
                          setActionTitles((current) => ({ ...current, [item.id]: e.target.value }))
                        }
                        data-testid={`countermeasure-action-title-${item.id}`}
                        placeholder="Action title"
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={() => handleLinkAction(item.id)}
                      data-testid={`link-countermeasure-action-${item.id}`}
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

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
