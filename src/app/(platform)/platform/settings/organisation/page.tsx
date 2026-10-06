import { notFound } from "next/navigation";

import { RolloutGovernancePanel } from "@/components/organisation-rollout/rollout-governance-panel";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadOrganisationGovernanceSnapshot } from "@/modules/organisation-rollout/queries";
import {
  MULTI_SITE_INTENT_LABELS,
  MULTI_SITE_INTENTS,
} from "@/modules/organisation-rollout/multi-site-intent";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { updateMultiSiteIntent } from "./actions";

export default async function OrganisationSettingsPage() {
  if (!(await currentMemberHasPermission("hierarchy.read"))) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: organisation }, governance] = await Promise.all([
    supabase
      .from("organisations")
      .select("name, code, locale, time_zone, reporting_currency, status")
      .maybeSingle(),
    loadOrganisationGovernanceSnapshot(),
  ]);

  if (!organisation) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Organisation"
          description="Organisation details are unavailable."
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-10"
      data-testid="organisation-settings-page"
    >
      <PageHeader
        title="Organisation"
        description="The company or group. Sites are operational locations inside this organisation."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform/settings" data-testid="settings-back-link">
              Back to settings
            </AppLink>
          </Button>
        }
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-medium text-foreground">
          Organisation details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={organisation.name} />
          <Detail label="Code" value={organisation.code} />
          <Detail label="Locale" value={organisation.locale} />
          <Detail label="Time zone" value={organisation.time_zone} />
          <Detail
            label="Reporting currency"
            value={organisation.reporting_currency}
          />
          <Detail label="Status" value={organisation.status} capitalize />
        </dl>
        {governance?.canManageHierarchy ? (
          <form
            action={updateMultiSiteIntent}
            className="flex max-w-xl flex-col gap-3"
            data-testid="multi-site-intent-form"
          >
            <label htmlFor="multiSiteIntent" className="text-sm font-medium">
              Wider multi-site organisation
            </label>
            <select
              id="multiSiteIntent"
              name="multiSiteIntent"
              defaultValue={governance.multiSiteIntent}
              className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
            >
              {MULTI_SITE_INTENTS.map((value) => (
                <option key={value} value={value}>
                  {MULTI_SITE_INTENT_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Planning context only. This does not buy capacity or grant access.
            </p>
            <Button
              type="submit"
              variant="outline"
              className="min-h-11 self-start"
            >
              Save context
            </Button>
          </form>
        ) : null}
      </section>

      {governance ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-medium text-foreground">
            Rollout & Governance
          </h2>
          <RolloutGovernancePanel snapshot={governance} />
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-sm text-foreground ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
