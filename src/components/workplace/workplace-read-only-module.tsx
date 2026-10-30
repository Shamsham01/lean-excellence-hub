import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";
import { loadWorkplaceFeed } from "@/modules/workplace/feed";

export async function WorkplaceReadOnlyModule({
  module,
  title,
}: {
  module: WorkplaceModuleKey;
  title: string;
}) {
  const feed = await loadWorkplaceFeed(module);

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="workplace-read-only-module"
    >
      <PageHeader
        title={title}
        description="Viewing access shows shared records in your scope. Creating, editing, and administration need a separate role."
      />
      {feed.status === "error" ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="workplace-feed-error"
        >
          {feed.message}
        </p>
      ) : feed.records.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="workplace-feed-empty"
        >
          No shared records are in your scope yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {feed.records.map((record) => (
            <li key={record.id} className="border-t border-border py-3">
              <AppLink
                href={`/platform/workplace/${module}/${record.id}`}
                className="font-medium text-foreground"
              >
                {record.title}
              </AppLink>
              <p className="text-sm text-muted-foreground">
                {[record.status, record.scopeName, record.summary]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
