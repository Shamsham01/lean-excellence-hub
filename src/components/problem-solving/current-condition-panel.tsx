"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createCurrentConditionItem,
  verifyCurrentConditionItem,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CURRENT_CONDITION_CATEGORIES,
  currentConditionCategoryLabel,
  type ProblemSolvingCurrentConditionItem,
} from "@/lib/problem-solving/types";

type CurrentConditionPanelProps = {
  caseId: string;
  items: ProblemSolvingCurrentConditionItem[];
  canContribute: boolean;
};

export function CurrentConditionPanel({
  caseId,
  items,
  canContribute,
}: CurrentConditionPanelProps) {
  const router = useRouter();
  const [category, setCategory] = useState<string>(
    CURRENT_CONDITION_CATEGORIES[0],
  );
  const [statement, setStatement] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeItems = items.filter((item) => item.status === "active");

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!statement.trim()) return;
    setLoading(true);
    const result = await createCurrentConditionItem({
      caseId,
      category,
      statement: statement.trim(),
    });
    setMessage(result.error ?? "Item added");
    setStatement("");
    setLoading(false);
    router.refresh();
  }

  async function handleVerify(itemId: string) {
    setLoading(true);
    const result = await verifyCurrentConditionItem(
      itemId,
      caseId,
      "Verified from workspace",
    );
    setMessage(result.error ?? "Item verified");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-current-condition-panel"
    >
      {canContribute ? (
        <Card>
          <CardHeader>
            <CardTitle>Add current condition item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Category</span>
                <select
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="current-condition-category"
                >
                  {CURRENT_CONDITION_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {currentConditionCategoryLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Statement</span>
                <Input
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  data-testid="current-condition-statement"
                />
              </label>
              <Button type="submit" size="sm" disabled={loading}>
                Add item
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current condition ({activeItems.length} active)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {activeItems.length === 0 ? (
            <p className="text-muted-foreground">
              No current condition items yet.
            </p>
          ) : (
            activeItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`current-condition-item-${item.id}`}
              >
                <div>
                  <Badge variant="outline" className="mb-1">
                    {currentConditionCategoryLabel(item.category)}
                  </Badge>
                  <p>{item.statement}</p>
                  {item.verified_at ? (
                    <p className="text-xs text-muted-foreground">Verified</p>
                  ) : null}
                </div>
                {canContribute && !item.verified_at ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => handleVerify(item.id)}
                  >
                    Verify
                  </Button>
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
