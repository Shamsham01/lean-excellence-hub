import { PageHeader } from "@/components/platform/page-header";
import type { WorkplaceModuleKey } from "@/modules/workplace/access";
import { loadWorkplaceRecord } from "@/modules/workplace/feed";

export async function WorkplaceReadOnlyRecord({
  module,
  recordId,
  title,
}: {
  module: WorkplaceModuleKey;
  recordId: string;
  title: string;
}) {
  const result = await loadWorkplaceRecord(module, recordId);

  return (
    <div className="flex flex-col gap-6" data-testid="workplace-read-only-record">
      <PageHeader
        title={title}
        description="This view includes the shared summary. Drafts, financial amounts, other people's assessments, and editing stay unavailable."
      />
      {result.status === "error" ? (
        <p className="text-sm text-destructive" role="alert" data-testid="workplace-record-error">
          {result.message}
        </p>
      ) : result.record === null ? (
        <p className="text-sm text-muted-foreground" data-testid="workplace-record-unavailable">
          This record is not available with your access. It may be a draft, outside your site, or restricted.
        </p>
      ) : (
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Record</dt>
            <dd className="font-medium text-foreground">{result.record.title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-foreground">{result.record.status}</dd>
          </div>
          {result.record.scopeName ? (
            <div>
              <dt className="text-muted-foreground">Scope</dt>
              <dd className="text-foreground">{result.record.scopeName}</dd>
            </div>
          ) : null}
          {result.record.summary ? (
            <div>
              <dt className="text-muted-foreground">Summary</dt>
              <dd className="text-foreground">{result.record.summary}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}
