import { SetupBuilderWorkspace } from "@/components/module-setup/setup-builder-workspace";
import { AppLink } from "@/components/ui/app-link";
import { gembaSetupBuilderModule } from "@/modules/gemba/ai-builder/module";
import { gembaBuilderSnapshot } from "@/modules/gemba/ai-builder/view";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { loadModuleSetupBuilderConversation } from "@/modules/module-setup/ai-builder/execute";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  createGembaDraftFromProposal,
  discardGembaSetupBuilderConversation,
  sendGembaSetupBuilderMessage,
} from "../actions";

export const metadata = { title: "Build Gemba with LeanAI" };

const STARTERS = [
  "We want leaders to notice what is stopping the team today.",
  "Ask what the walk should help people see before you draft prompts.",
];

export default async function GembaLeanAiSetupPage() {
  const [access, identity, site] = await Promise.all([
    loadModuleSetupBuilderAccess({
      managePermission: GEMBA_PERMISSIONS.definitionsManage,
      moduleLabel: "Gemba definitions",
    }),
    loadCurrentOrganisationIdentity(),
    loadActiveSiteContext(),
  ]);
  const creationUnits = buildSiteScopedUnitOptions(site.units, site.context, {
    requireConcreteSite: true,
  });
  const supabase = await createServerSupabaseClient();
  const [{ data: existing }, conversation] = await Promise.all([
    supabase.from("gemba_definitions").select("display_name"),
    access.available && identity
      ? loadModuleSetupBuilderConversation(
          gembaSetupBuilderModule,
          identity.organisationId,
        )
      : Promise.resolve(null),
  ]);

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="gemba-leanai-page"
    >
      <AppLink
        href="/platform/gemba/setup"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        All setup choices
      </AppLink>
      <SetupBuilderWorkspace
        moduleLabel="Gemba"
        noun="Gemba definition"
        setupHref="/platform/gemba/setup"
        manualHref="/platform/gemba/definitions#create-definition"
        quickStartHref="/platform/gemba/setup/quick-start"
        starters={STARTERS}
        existingNames={(existing ?? []).map((row) => row.display_name)}
        units={creationUnits.units}
        requiresSiteSelection={creationUnits.requiresSiteSelection}
        showThreshold={false}
        initial={conversation ? gembaBuilderSnapshot(conversation) : null}
        unavailableMessage={access.available ? null : access.message}
        send={sendGembaSetupBuilderMessage}
        createDraft={createGembaDraftFromProposal}
        discard={discardGembaSetupBuilderConversation}
      />
    </div>
  );
}
