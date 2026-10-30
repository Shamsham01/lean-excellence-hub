import { AppLink } from "@/components/ui/app-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";
import {
  loadWorkplaceFeed,
  type WorkplaceFeedRecord,
} from "@/modules/workplace/feed";

function ActivityList({
  title,
  module,
  result,
}: {
  title: string;
  module: WorkplaceModuleKey;
  result:
    | { status: "ready"; records: WorkplaceFeedRecord[] }
    | { status: "error"; message: string };
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {result.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {result.message}
        </p>
      ) : result.records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No shared {title.toLowerCase()} records are in your scope yet.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {result.records.slice(0, 3).map((record) => (
            <li key={record.id}>
              <AppLink
                href={`/platform/workplace/${module}/${record.id}`}
                className="text-sm text-foreground underline-offset-2 hover:underline"
              >
                {record.title}
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function WorkplaceHomeActivity() {
  const [actions, fiveS, gemba] = await Promise.all([
    loadWorkplaceFeed("actions"),
    loadWorkplaceFeed("five_s"),
    loadWorkplaceFeed("gemba"),
  ]);

  return (
    <Card data-testid="home-workplace-activity">
      <CardHeader>
        <CardTitle>Workplace activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Shared records in your viewing scope. Creating, editing, and
          administration need a separate role.
        </p>
        <ActivityList title="Actions" module="actions" result={actions} />
        <ActivityList title="5S" module="five_s" result={fiveS} />
        <ActivityList title="Gemba" module="gemba" result={gemba} />
      </CardContent>
    </Card>
  );
}
