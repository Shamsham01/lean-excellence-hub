import { AppLink } from "@/components/ui/app-link";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";
import {
  loadWorkplaceFeedPage,
  type WorkplaceFeedRecord,
} from "@/modules/workplace/feed";
import { workplacePageHref } from "@/modules/workplace/page-query";

export async function WorkplaceRecordList({
  module,
  emptyLabel,
}: {
  module: WorkplaceModuleKey;
  emptyLabel: string;
}) {
  const feed = await loadWorkplaceFeedPage(module);
  const previousHref =
    feed.status === "ready" && feed.page > 1
      ? await workplacePageHref(feed.page - 1)
      : null;
  const nextHref =
    feed.status === "ready" && feed.hasMore
      ? await workplacePageHref(feed.page + 1)
      : null;

  if (feed.status === "error") {
    return (
      <p
        className="text-sm text-destructive"
        role="alert"
        data-testid="workplace-feed-error"
      >
        {feed.message}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="workplace-feed">
      {feed.records.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="workplace-feed-empty"
        >
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {feed.records.map((record) => (
            <WorkplaceRecordItem
              key={record.id}
              module={module}
              record={record}
            />
          ))}
        </ul>
      )}
      {previousHref || nextHref ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {previousHref ? (
            <AppLink href={previousHref} data-testid="workplace-feed-previous">
              Previous page
            </AppLink>
          ) : null}
          {nextHref ? (
            <AppLink href={nextHref} data-testid="workplace-feed-next">
              Next page
            </AppLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkplaceRecordItem({
  module,
  record,
}: {
  module: WorkplaceModuleKey;
  record: WorkplaceFeedRecord;
}) {
  return (
    <li className="min-w-0 border-t border-border py-3">
      <AppLink
        href={`/platform/workplace/${module}/${record.id}`}
        className="font-medium break-words text-foreground"
      >
        {record.title}
      </AppLink>
      <p className="text-sm break-words text-muted-foreground">
        {[record.status, record.scopeName, record.summary]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}
