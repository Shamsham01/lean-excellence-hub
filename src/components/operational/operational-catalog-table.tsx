import { AppLink } from "@/components/ui/app-link";
import {
  OperationalCatalogStartAction,
  type OperationalCatalogStartActionConfig,
} from "@/components/operational/operational-catalog-row-actions";

export type OperationalCatalogRow = {
  id: string;
  name: string;
  href: string;
  start: OperationalCatalogStartActionConfig | null;
};

export function OperationalCatalogTable({
  rows,
  nameColumnLabel,
  actionColumnLabel,
  testId,
}: {
  rows: OperationalCatalogRow[];
  nameColumnLabel: string;
  actionColumnLabel: string;
  testId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>
        Nothing published yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[20rem] text-sm" data-testid={testId}>
        <thead className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{nameColumnLabel}</th>
            <th className="px-3 py-2 font-medium text-right">
              {actionColumnLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <AppLink
                  href={row.href}
                  className="font-medium underline-offset-4 hover:underline"
                  data-testid={`${testId}-link-${row.id}`}
                >
                  {row.name}
                </AppLink>
              </td>
              <td className="px-3 py-2 text-right">
                <OperationalCatalogStartAction start={row.start} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
