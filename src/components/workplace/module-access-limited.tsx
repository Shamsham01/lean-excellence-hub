import { EmptyState } from "@/components/platform/empty-state";
import { PageHeader } from "@/components/platform/page-header";

export function ModuleAccessLimited({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-8" data-testid="module-access-limited">
      <PageHeader
        title={title}
        description="Your role does not open this module workspace."
      />
      <EmptyState
        title="Records stay within your access"
        description="Workplace Viewer shows published and shared records for an authorised site. A module role is required to review, edit, or administer them."
      />
    </div>
  );
}
