import { WorkplaceRecordList } from "@/components/workplace/workplace-record-list";
import {
  WORKPLACE_VIEW_PERMISSION,
  type WorkplaceModuleKey,
} from "@/modules/workplace/access";
import { loadWorkplaceFeedPage } from "@/modules/workplace/feed";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export async function WorkplaceSharedRecords({
  module,
}: {
  module: WorkplaceModuleKey;
  /** @deprecated Title copy removed; kept for call-site compatibility. */
  title?: string;
}) {
  if (!(await currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION))) {
    return null;
  }

  const feed = await loadWorkplaceFeedPage(module);
  if (feed.status !== "ready" || feed.records.length === 0) {
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
      <WorkplaceRecordList
        module={module}
        emptyLabel="No shared records are in your viewing scope yet."
      />
    </section>
  );
}
