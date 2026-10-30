import { WorkplaceRecordList } from "@/components/workplace/workplace-record-list";
import {
  WORKPLACE_VIEW_PERMISSION,
  type WorkplaceModuleKey,
} from "@/modules/workplace/access";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export async function WorkplaceSharedRecords({
  module,
  title,
}: {
  module: WorkplaceModuleKey;
  title: string;
}) {
  if (!(await currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION))) {
    return null;
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-6"
      aria-labelledby={`workplace-shared-${module}`}
      data-testid="workplace-shared-records"
    >
      <h2
        id={`workplace-shared-${module}`}
        className="text-base font-medium text-foreground"
      >
        Shared workplace records
      </h2>
      <p className="text-sm text-muted-foreground">
        {title} you can view at another site or through Workplace Viewer stay in
        this list. Opening one shows the shared summary. It does not add create,
        edit, approval, or administration rights.
      </p>
      <WorkplaceRecordList
        module={module}
        emptyLabel="No shared records are in your viewing scope yet."
      />
    </section>
  );
}
