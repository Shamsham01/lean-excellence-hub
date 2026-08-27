"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSustainmentItem } from "@/app/(platform)/platform/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type SustainmentPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  membershipNameById: Record<string, string>;
  canManage: boolean;
};

export function SustainmentPanel({
  caseId,
  detail,
  membershipNameById,
  canManage,
}: SustainmentPanelProps) {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [checkMethod, setCheckMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!what.trim()) return;
    setLoading(true);
    const result = await createSustainmentItem({
      caseId,
      what: what.trim(),
      ...(checkMethod.trim() ? { checkMethod: checkMethod.trim() } : {}),
    });
    setMessage(result.error ?? "Sustainment item created");
    setWhat("");
    setCheckMethod("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="problem-solving-sustainment-panel">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add sustainment item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>What will be sustained</span>
                <Textarea
                  rows={2}
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  data-testid="sustainment-what"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Check method</span>
                <Input
                  value={checkMethod}
                  onChange={(e) => setCheckMethod(e.target.value)}
                  data-testid="sustainment-check-method"
                />
              </label>
              <Button type="submit" size="sm" disabled={loading} data-testid="create-sustainment-item">
                Create sustainment item
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sustainment items ({detail.sustainment_items.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.sustainment_items.length === 0 ? (
            <p className="text-muted-foreground">No sustainment items yet.</p>
          ) : (
            detail.sustainment_items.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border px-3 py-2"
                data-testid={`sustainment-item-${item.id}`}
              >
                <p className="font-medium">{item.what}</p>
                <p className="text-muted-foreground">
                  Owner:{" "}
                  {item.owner_membership_id
                    ? membershipNameById[item.owner_membership_id] ?? item.owner_membership_id.slice(0, 8)
                    : "—"}
                  {item.follow_up_date ? ` · Follow-up ${item.follow_up_date}` : ""}
                  {item.result ? ` · ${item.result}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lessons learned ({detail.lessons_learned.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.lessons_learned.length === 0 ? (
            <p className="text-muted-foreground">No lessons captured yet.</p>
          ) : (
            detail.lessons_learned.map((lesson) => (
              <div key={lesson.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">{lesson.what_happened}</p>
                <p className="text-muted-foreground">{lesson.what_learned}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
