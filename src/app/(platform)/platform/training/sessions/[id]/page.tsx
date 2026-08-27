import { notFound } from "next/navigation";

import { SessionWorkspace } from "@/components/training/session-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function TrainingSessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const canManage = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.sessionsManage,
  );
  const canComplete = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.completionsManage,
  );

  const { data: session } = await supabase
    .from("training_sessions")
    .select(
      "id, title, status, scheduled_start, scheduled_end, course_version_id, organisational_unit_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: courseVersion } = await supabase
    .from("training_course_versions")
    .select("id, version_number, course_id")
    .eq("id", session.course_version_id)
    .maybeSingle();

  const { data: course } = courseVersion
    ? await supabase
        .from("training_courses")
        .select("name")
        .eq("id", courseVersion.course_id)
        .maybeSingle()
    : { data: null };

  const { data: participantRows } = await supabase
    .from("training_session_participants")
    .select("id, membership_id, status")
    .eq("session_id", id);

  const membershipIds = participantRows?.map((p) => p.membership_id) ?? [];
  const { data: memberships } = membershipIds.length
    ? await supabase
        .from("organisation_memberships")
        .select("id, display_name")
        .in("id", membershipIds)
    : { data: [] };

  const { data: allMemberships } = await supabase
    .from("organisation_memberships")
    .select("id, display_name")
    .eq("status", "active")
    .order("display_name");

  const participants =
    participantRows?.map((row) => {
      const membership = memberships?.find((m) => m.id === row.membership_id);
      return {
        id: row.id,
        membership_id: row.membership_id,
        display_name: membership?.display_name ?? row.membership_id,
        status: row.status,
      };
    }) ?? [];

  const existingIds = new Set(membershipIds);
  const availableMemberships =
    allMemberships
      ?.filter((m) => !existingIds.has(m.id))
      .map((m) => ({ id: m.id, label: m.display_name ?? m.id })) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={session.title}
        description={`${course?.name ?? "Course"} · Version ${courseVersion?.version_number ?? "—"} · ${session.status}`}
      />
      <SessionWorkspace
        sessionId={session.id}
        sessionTitle={session.title}
        courseName={course?.name ?? "Course"}
        courseVersionLabel={`Version ${courseVersion?.version_number ?? "—"}`}
        courseVersionId={session.course_version_id}
        canManage={canManage}
        canComplete={canComplete}
        participants={participants}
        availableMemberships={availableMemberships}
      />
    </div>
  );
}
