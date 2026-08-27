"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type ProgrammeVersion = { id: string; programme_name: string };

type Category = { id: string; name: string };

type NewSuggestionFormProps = {
  programmeVersions: ProgrammeVersion[];

  categories: Category[];
};

function rpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return "Submission failed";
}

export function NewSuggestionForm({
  programmeVersions,

  categories,
}: NewSuggestionFormProps) {
  const router = useRouter();

  const [programmeVersionId, setProgrammeVersionId] = useState(
    programmeVersions[0]?.id ?? "",
  );

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");

  const [noticed, setNoticed] = useState("");

  const [proposed, setProposed] = useState("");

  const [benefit, setBenefit] = useState("");

  const [title, setTitle] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const canSubmit = programmeVersions.length > 0 && categories.length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!programmeVersionId) {
      setError("Select a programme");

      return;
    }

    if (!categoryId) {
      setError("Select a category");

      return;
    }

    setLoading(true);

    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();

      const { data: draftId, error: draftError } = await supabase.rpc(
        "create_suggestion_draft",

        {
          target_programme_version_id: programmeVersionId,

          target_category_id: categoryId,

          target_title: title || proposed.slice(0, 80),

          target_problem_or_opportunity: noticed,

          target_proposed_idea: proposed,

          ...(benefit ? { target_expected_benefit_summary: benefit } : {}),
        },
      );

      if (draftError) throw draftError;

      const { error: submitError } = await supabase.rpc("submit_suggestion", {
        target_suggestion_id: draftId as string,
      });

      if (submitError) throw submitError;

      router.push(`/platform/suggestions/${draftId as string}`);

      router.refresh();
    } catch (err) {
      setError(rpcErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-testid="new-suggestion-form">
      <CardHeader>
        <CardTitle>Share an improvement idea</CardTitle>
      </CardHeader>

      <CardContent>
        {!canSubmit ? (
          <p className="mb-4 text-sm text-muted-foreground">
            No published programmes or categories are available yet. Ask a
            programme manager to configure suggestion programmes before
            submitting ideas.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>What have you noticed?</span>

            <textarea
              required

              rows={3}

              className="border-input min-h-[88px] rounded-md border bg-background px-3 py-2"

              value={noticed}

              onChange={(e) => setNoticed(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>What would you change?</span>

            <textarea
              required

              rows={3}

              className="border-input min-h-[88px] rounded-md border bg-background px-3 py-2"

              value={proposed}

              onChange={(e) => setProposed(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Short title (optional)</span>

            <input
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Programme</span>

            <select
              required

              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"

              value={programmeVersionId}

              onChange={(e) => setProgrammeVersionId(e.target.value)}

              disabled={programmeVersions.length === 0}
            >
              {programmeVersions.length === 0 ? (
                <option value="">No programmes available</option>
              ) : (
                programmeVersions.map((pv) => (
                  <option key={pv.id} value={pv.id}>
                    {pv.programme_name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Category</span>

            <select
              required

              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"

              value={categoryId}

              onChange={(e) => setCategoryId(e.target.value)}

              disabled={categories.length === 0}
            >
              {categories.length === 0 ? (
                <option value="">No categories available</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Expected benefit (optional)</span>

            <textarea
              rows={2}

              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"

              value={benefit}

              onChange={(e) => setBenefit(e.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            disabled={loading || !canSubmit}
            className="min-h-11"
          >
            {loading ? "Submitting…" : "Submit idea"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
