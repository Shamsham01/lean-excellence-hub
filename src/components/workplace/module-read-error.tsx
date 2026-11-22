import { PageHeader } from "@/components/platform/page-header";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";

export function ModuleReadError({
  title,
  description,
  message,
  module,
}: {
  title: string;
  description: string;
  message: string;
  module: WorkplaceModuleKey;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={title} description={description} />
      <p
        className="text-sm text-destructive"
        role="alert"
        data-testid="module-read-error"
      >
        {message}
      </p>
      <WorkplaceSharedRecords module={module} title={title} />
    </div>
  );
}
