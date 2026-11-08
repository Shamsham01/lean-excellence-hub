import { SetupBuilderWorkspace } from "@/components/module-setup/setup-builder-workspace";
import { TrainingTerminologyNote } from "@/components/training/setup/training-terminology";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { loadModuleSetupBuilderConversation } from "@/modules/module-setup/ai-builder/execute";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { trainingSetupBuilderModule } from "@/modules/training/ai-builder/module";
import { trainingBuilderSnapshot } from "@/modules/training/ai-builder/view";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  createTrainingDraftFromProposal,
  discardTrainingSetupBuilderConversation,
  sendTrainingSetupBuilderMessage,
} from "../actions";

const STARTERS = [
  "We need onboarding for new line operators in food manufacturing.",
  "Start with mandatory safety and quality courses before sessions.",
];

export default async function TrainingLeanAiSetupPage() {
  const access = await loadModuleSetupBuilderAccess({
    managePermission: TRAINING_PERMISSIONS.curriculumManage,
    requiredPermissions: [
      TRAINING_PERMISSIONS.catalogManage,
      TRAINING_PERMISSIONS.curriculumManage,
    ],
    moduleLabel: "Training",
  });
  const [organisation, supabase] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    createServerSupabaseClient(),
  ]);
  const [{ data: courses }, conversation] = await Promise.all([
    supabase.from("training_courses").select("name").order("name").limit(40),
    access.available && organisation
      ? loadModuleSetupBuilderConversation(
          trainingSetupBuilderModule,
          organisation.organisationId,
        )
      : Promise.resolve(null),
  ]);

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="training-leanai-page"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/training/setup/manual">
            Continue manually
          </AppLink>
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/training/setup/quick-start">
            Use Quick Start
          </AppLink>
        </Button>
      </div>
      <TrainingTerminologyNote />
      <SetupBuilderWorkspace
        moduleLabel="Training"
        noun="Training catalogue"
        setupHref="/platform/training/setup"
        manualHref="/platform/training/setup/manual"
        quickStartHref="/platform/training/setup/quick-start"
        starters={STARTERS}
        existingNames={(courses ?? []).map((row) => row.name)}
        units={[]}
        requiresSiteSelection={false}
        showThreshold={false}
        showApplicability={false}
        initial={conversation ? trainingBuilderSnapshot(conversation) : null}
        unavailableMessage={access.available ? null : access.message}
        send={sendTrainingSetupBuilderMessage}
        createDraft={createTrainingDraftFromProposal}
        discard={discardTrainingSetupBuilderConversation}
      />
    </div>
  );
}
