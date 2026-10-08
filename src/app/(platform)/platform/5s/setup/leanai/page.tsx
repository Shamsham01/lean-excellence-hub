import { SetupBuilderWorkspace } from "@/components/module-setup/setup-builder-workspace";
import { AppLink } from "@/components/ui/app-link";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { loadModuleSetupBuilderConversation } from "@/modules/module-setup/ai-builder/execute";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { fiveSSetupBuilderModule } from "@/modules/5s/ai-builder/module";
import { fiveSBuilderSnapshot } from "@/modules/5s/ai-builder/view";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  createFiveSDraftFromProposal,
  discardFiveSSetupBuilderConversation,
  sendFiveSSetupBuilderMessage,
} from "../actions";

export const metadata = { title: "Build 5S with LeanAI" };

const STARTERS = [
  "We want a short workplace check for a packing area.",
  "Ask what the team should notice before you draft anything.",
];

export default async function FiveSLeanAiSetupPage() {
  const [access, identity, site] = await Promise.all([
    loadModuleSetupBuilderAccess({
      managePermission: FIVE_S_PERMISSIONS.standardsManage,
      moduleLabel: "5S standards",
    }),
    loadCurrentOrganisationIdentity(),
    loadActiveSiteContext(),
  ]);
  const creationUnits = buildSiteScopedUnitOptions(site.units, site.context, {
    requireConcreteSite: true,
  });
  const supabase = await createServerSupabaseClient();
  const [{ data: existing }, conversation] = await Promise.all([
    supabase.from("five_s_standards").select("display_name"),
    access.available && identity
      ? loadModuleSetupBuilderConversation(
          fiveSSetupBuilderModule,
          identity.organisationId,
        )
      : Promise.resolve(null),
  ]);

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="five-s-leanai-page"
    >
      <AppLink
        href="/platform/5s/setup"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        All setup choices
      </AppLink>
      <SetupBuilderWorkspace
        moduleLabel="5S"
        noun="5S standard"
        setupHref="/platform/5s/setup"
        manualHref="/platform/5s/standards#create-standard"
        quickStartHref="/platform/5s/setup/quick-start"
        starters={STARTERS}
        existingNames={(existing ?? []).map((row) => row.display_name)}
        units={creationUnits.units}
        requiresSiteSelection={creationUnits.requiresSiteSelection}
        showThreshold
        initial={conversation ? fiveSBuilderSnapshot(conversation) : null}
        unavailableMessage={access.available ? null : access.message}
        send={sendFiveSSetupBuilderMessage}
        createDraft={createFiveSDraftFromProposal}
        discard={discardFiveSSetupBuilderConversation}
      />
    </div>
  );
}
