import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  recognitionSourceHref,
  recognitionSourceOpenLabel,
} from "@/lib/recognition/source";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

async function resolveSourceLink(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  sourceResourceId: string,
) {
  const { data: suggestion } = await supabase
    .from("improvement_suggestions")
    .select("id, title")
    .eq("id", sourceResourceId)
    .maybeSingle();
  if (suggestion) {
    return {
      resourceType: "improvement_suggestion",
      title: suggestion.title,
    };
  }

  const { data: project } = await supabase
    .from("ci_projects")
    .select("id, title")
    .eq("id", sourceResourceId)
    .maybeSingle();
  if (project) {
    return {
      resourceType: "ci_project",
      title: project.title,
    };
  }

  const { data: action } = await supabase
    .from("actions")
    .select("id, title")
    .eq("id", sourceResourceId)
    .maybeSingle();
  if (action) {
    return {
      resourceType: "action",
      title: action.title,
    };
  }

  return null;
}

export default async function RecognitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: award } = await supabase
    .from("recognition_awards")
    .select(
      "id, title, message, recognition_type_name_snapshot, awarded_at, status, source_resource_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!award) notFound();

  const { data: recipients } = await supabase
    .from("recognition_recipients")
    .select("membership_id")
    .eq("recognition_award_id", id);

  const membershipIds = [
    ...new Set(recipients?.map((row) => row.membership_id) ?? []),
  ];

  const { data: memberships } = membershipIds.length
    ? await supabase
        .from("organisation_memberships")
        .select("id, display_name")
        .in("id", membershipIds)
    : { data: [] };

  const membershipName = (membershipId: string) =>
    memberships?.find((row) => row.id === membershipId)?.display_name ??
    "Person";

  const source =
    award.source_resource_id != null
      ? await resolveSourceLink(supabase, award.source_resource_id)
      : null;
  const sourceHref =
    source && award.source_resource_id
      ? recognitionSourceHref(source.resourceType, award.source_resource_id)
      : null;

  return (
    <div className="flex flex-col gap-6" data-testid="recognition-detail-page">
      <PageHeader
        title={award.title}
        description={award.recognition_type_name_snapshot}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/recognition"
              data-testid="recognition-detail-back-link"
            >
              Back to recognition
            </AppLink>
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle className="text-base">Award</CardTitle>
          <Badge variant={award.status === "active" ? "secondary" : "outline"}>
            {award.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="leading-relaxed">{award.message}</p>
          <p className="text-muted-foreground">
            Awarded {new Date(award.awarded_at).toLocaleDateString("en-GB")}
          </p>
          <div>
            <p className="text-muted-foreground">Recipients</p>
            <ul className="mt-2 space-y-1">
              {recipients?.map((recipient) => (
                <li key={recipient.membership_id}>
                  <AppLink
                    href={`/platform/people/${recipient.membership_id}`}
                    className="text-primary hover:underline"
                    data-testid={`recognition-recipient-link-${recipient.membership_id}`}
                  >
                    {membershipName(recipient.membership_id)}
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
          {sourceHref ? (
            <AppLink
              href={sourceHref}
              className="inline-flex text-primary hover:underline"
              data-testid="recognition-source-link"
              aria-label={recognitionSourceOpenLabel(
                source?.resourceType,
                source?.title,
              )}
            >
              {recognitionSourceOpenLabel(source?.resourceType, source?.title)}
            </AppLink>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
