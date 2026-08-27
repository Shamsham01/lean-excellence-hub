import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { untypedFrom } from "@/lib/projects/supabase-untyped";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProjectMethodologiesPage() {
  const canRead = await currentMemberHasPermission("projects.read");
  const canManage = await currentMemberHasPermission("projects.manage");
  if (!canRead && !canManage) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: methodologies } = await untypedFrom(
    supabase,
    "ci_project_methodologies",
  )
    .select("id, name, code, description, status")
    .order("name");

  const { data: versions } = await untypedFrom(
    supabase,
    "ci_project_methodology_versions",
  )
    .select("id, methodology_id, version_number, status, published_at")
    .order("version_number");

  const methodologyRows =
    (methodologies as Array<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      status: string;
    }> | null) ?? [];

  const versionRows =
    (versions as Array<{
      id: string;
      methodology_id: string;
      version_number: number;
      status: string;
      published_at: string | null;
    }> | null) ?? [];

  const publishedByMethodology = new Map(
    versionRows
      .filter((version) => version.status === "published")
      .map((version) => [version.methodology_id, version]),
  );

  return (
    <div className="flex flex-col gap-8" data-testid="methodology-manager-page">
      <PageHeader
        title="Project methodologies"
        description="Define phased improvement approaches for your CI projects."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/projects">Back to projects</Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        {methodologyRows.map((methodology) => {
          const published = publishedByMethodology.get(methodology.id);
          return (
            <Card key={methodology.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={`/platform/projects/methodologies/${methodology.id}`}
                      className="hover:underline"
                    >
                      {methodology.name}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {methodology.code}
                  </p>
                </div>
                <Badge variant="outline">{methodology.status}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {methodology.description ? (
                  <p>{methodology.description}</p>
                ) : null}
                {published ? (
                  <p className="mt-2">
                    Published version {published.version_number}
                    {published.published_at
                      ? ` · ${new Date(published.published_at).toLocaleDateString("en-GB")}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-2">No published version yet</p>
                )}
                {canManage ? (
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <Link
                      href={`/platform/projects/methodologies/${methodology.id}`}
                    >
                      Open editor
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
