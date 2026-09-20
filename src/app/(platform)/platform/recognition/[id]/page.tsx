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

async function sourceTitle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  resourceType: string,
  resourceId: string,
) {
  if (resourceType === "improvement_suggestion") {
    const { data } = await supabase
      .from("improvement_suggestions")
      .select("title")
      .eq("id", resourceId)
      .maybeSingle();
    return data?.title ?? null;
  }
  if (resourceType === "ci_project") {
    const { data } = await supabase
      .from("ci_projects")
      .select("title")
      .eq("id", resourceId)
      .maybeSingle();
    return data?.title ?? null;
  }
  if (resourceType === "action") {
    const { data } = await supabase
      .from("actions")
      .select("title")
      .eq("id", resourceId)
      .maybeSingle();
    return data?.title ?? null;
  }
  return null;
}

export default async function RecognitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: award } = await supabase
    .from("recognition_awards")
    .select(
      "id, title, message, recognition_type_name_snapshot, awarded_at, status, source_resource_id, awarded_by_membership_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!award) notFound();

  const { data: recipients } = await supabase
    .from("recognition_recipients")
    .select("membership_id")
    .eq("recognition_award_id", id);

  const membershipIds = [
    ...new Set(
      [
        ...(recipients?.map((row) => row.membership_id) ?? []),
        award.awarded_by_membership_id,
      ].filter(Boolean),
    ),
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

  const { data: sourceResource } = award.source_resource_id
    ? await supabase
        .from("resource_records")
        .select("id, resource_type")
        .eq("id", award.source_resource_id)
        .maybeSingle()
    : { data: null };

  const sourceHref =
    sourceResource && award.source_resource_id
      ? recognitionSourceHref(
          sourceResource.resource_type,
          award.source_resource_id,
        )
      : null;
  const sourceName =
    sourceResource && award.source_resource_id
      ? await sourceTitle(
          supabase,
          sourceResource.resource_type,
          award.source_resource_id,
        )
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
                sourceResource?.resource_type,
                sourceName,
              )}
            >
              {recognitionSourceOpenLabel(
                sourceResource?.resource_type,
                sourceName,
              )}
            </AppLink>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
