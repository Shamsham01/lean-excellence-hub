import { PageHeader } from "@/components/platform/page-header";
import { StartAssessmentForm } from "@/components/maturity/start-assessment-form";
import { loadStartAssessmentDialogProps } from "@/lib/maturity/load-start-assessment-props";

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string }>;
}) {
  const { versionId } = await searchParams;
  const { versions, people } = await loadStartAssessmentDialogProps();

  return (
    <div
      className="flex max-w-lg flex-col gap-8"
      data-testid="start-assessment-page"
    >
      <PageHeader
        title="Start assessment"
        description="Choose a Self snapshot or a Formal review with assessor control. Select a published framework, scope, and eligible entity."
      />
      <StartAssessmentForm
        versions={versions}
        people={people}
        {...(versionId ? { defaultVersionId: versionId } : {})}
      />
    </div>
  );
}
