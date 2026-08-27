import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { PillarScoreList } from "@/components/maturity/maturity-charts";
import { ScoreBadge } from "@/modules/maturity/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function OfficialResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: result } = await supabase
    .from("maturity_official_results")
    .select(
      "id, overall_score, published_at, model_name_snapshot, model_version_number_snapshot, unit_name_snapshot, unit_code_snapshot, assessment_type_snapshot",
    )
    .eq("id", id)
    .maybeSingle();

  if (!result) {
    notFound();
  }

  const { data: pillars } = await supabase
    .from("maturity_official_result_pillars")
    .select("pillar_name, score")
    .eq("official_result_id", id);

  const { data: levelSnapshots } = await supabase
    .from("maturity_official_result_levels")
    .select("level_number, name")
    .eq("official_result_id", id)
    .order("level_number");

  const pillarData = (pillars ?? []).map((p) => ({
    name: p.pillar_name,
    score: Number(p.score),
  }));

  const frameworkLabel = result.model_name_snapshot ?? "Framework";
  const unitLabel = result.unit_name_snapshot ?? "Unit";
  const versionLabel = result.model_version_number_snapshot
    ? `v${result.model_version_number_snapshot}`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Official maturity result"
        description={`${frameworkLabel}${versionLabel ? ` · ${versionLabel}` : ""} · ${unitLabel}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/platform/maturity">Back to overview</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Overall score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ScoreBadge score={Number(result.overall_score)} />
          <p className="typography-metadata">
            {result.assessment_type_snapshot === "formal"
              ? "Formal assessment"
              : result.assessment_type_snapshot}
            {" · "}
            Published{" "}
            {new Date(result.published_at).toLocaleDateString("en-GB")}
          </p>
          {result.unit_code_snapshot ? (
            <p className="text-sm text-muted-foreground">
              Unit code: {result.unit_code_snapshot}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {levelSnapshots && levelSnapshots.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Maturity levels (at publication)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {levelSnapshots.map((level) => (
                <li key={level.level_number}>
                  {level.level_number}. {level.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pillar scores</CardTitle>
        </CardHeader>
        <CardContent>
          <PillarScoreList data={pillarData} />
        </CardContent>
      </Card>
    </div>
  );
}
