import { PageHeader } from "@/components/platform/page-header";
import { WorkplaceRecordList } from "@/components/workplace/workplace-record-list";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";

export async function WorkplaceReadOnlyModule({
  module,
  title,
}: {
  module: WorkplaceModuleKey;
  title: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="workplace-read-only-module"
    >
      <PageHeader
        title={title}
        description="Viewing access shows shared records in your scope. Creating, editing, and administration need a separate role."
      />
      <WorkplaceRecordList
        module={module}
        emptyLabel="No shared records are in your scope yet."
      />
    </div>
  );
}
