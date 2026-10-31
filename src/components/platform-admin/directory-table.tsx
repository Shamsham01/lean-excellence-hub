import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { formatLondon, stripeModeLabel } from "@/modules/platform-admin/format";
import type { PlatformDirectory } from "@/modules/platform-admin/schemas";

import styles from "./directory-table.module.css";

function statusVariant(status: string) {
  if (status === "active") {
    return "success" as const;
  }
  if (status === "suspended" || status === "closed") {
    return "destructive" as const;
  }
  if (status === "provisioning") {
    return "warning" as const;
  }
  return "outline" as const;
}

export function OrganisationDirectoryTable({
  rows,
}: {
  rows: PlatformDirectory["rows"];
}) {
  return (
    <div className={styles.wrap} role="region" tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">Organisations</caption>
        <thead className={styles.head}>
          <tr>
            <th className={styles.headCell} scope="col">
              Organisation
            </th>
            <th className={styles.headCell} scope="col">
              Status
            </th>
            <th className={styles.headCell} scope="col">
              Owner
            </th>
            <th className={styles.headCell} scope="col">
              Sites
            </th>
            <th className={styles.headCell} scope="col">
              Subscription
            </th>
            <th className={styles.headCell} scope="col">
              Renewal
            </th>
          </tr>
        </thead>
        <tbody className={styles.body}>
          {rows.map((row) => (
            <tr className={styles.row} key={row.id}>
              <th className={styles.rowHeader} scope="row">
                <AppLink
                  className="underline-offset-4 hover:underline"
                  href={`/org_admin/organisations/${row.id}`}
                >
                  {row.name}
                </AppLink>
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {row.code}
                  {row.country_code ? ` · ${row.country_code}` : ""}
                </p>
              </th>
              <td className={styles.cell} data-label="Status">
                <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                {row.verified_customer ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verified customer
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Not a verified customer
                  </p>
                )}
              </td>
              <td className={styles.cell} data-label="Owner">
                <p>{row.owner_display_name ?? "No owner name"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.owner_email ?? "No owner email"}
                </p>
              </td>
              <td className={styles.cell} data-label="Sites">
                {row.active_site_count} active
                {row.site_quantity !== null
                  ? ` · ${row.site_quantity} subscribed`
                  : ""}
              </td>
              <td className={styles.cell} data-label="Subscription">
                <p>
                  {row.plan_code ?? "No plan"}
                  {row.billing_interval ? ` · ${row.billing_interval}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.billing_state ??
                    row.subscription_provider ??
                    "No subscription"}
                  {" · "}
                  {stripeModeLabel(row.stripe_livemode)}
                </p>
              </td>
              <td className={styles.cell} data-label="Renewal">
                {formatLondon(row.current_period_end)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
