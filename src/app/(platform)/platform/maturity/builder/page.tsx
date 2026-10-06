import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { MaturityBuilderWorkspace } from "@/components/maturity/ai-builder/maturity-builder-workspace";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MATURITY_BUILDER_MAX_MESSAGE_CHARS,
  MATURITY_BUILDER_MAX_TURNS,
} from "@/modules/maturity/ai-builder/types";
import { loadMaturityBuilderPageData } from "@/modules/maturity/ai-builder/load";

export const metadata = { title: "Build with LeanAI · Maturity frameworks" };

export default async function MaturityBuilderPage() {
  const data = await loadMaturityBuilderPageData();
  if (!data) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="maturity-builder-page">
      <PageHeader
        title="Build with LeanAI"
        description="Your framework. Your standards. Your way of working. LeanAI helps translate how you already run operations into a structure you review. Nothing is saved until you create a draft, and nothing is published until you choose Publish in the editor."
        actions={
          <Button variant="outline" asChild>
            <AppLink
              href="/platform/maturity/models"
              data-testid="maturity-builder-back-link"
            >
              All frameworks
            </AppLink>
          </Button>
        }
      />

      {data.access.available ? (
        <MaturityBuilderWorkspace
          initialConversation={data.conversation}
          maxMessageChars={MATURITY_BUILDER_MAX_MESSAGE_CHARS}
          maxTurns={MATURITY_BUILDER_MAX_TURNS}
        />
      ) : (
        <Card
          className="max-w-2xl shadow-sm"
          data-testid="maturity-builder-unavailable"
        >
          <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold text-foreground">
                The LeanAI builder is not available
              </h2>
              <p
                className="text-sm text-muted-foreground"
                data-testid="maturity-builder-unavailable-reason"
              >
                {data.access.message}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Quick Start and manual setup remain fully available and create the
              same kind of editable draft.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <AppLink href="/platform/maturity/models">
                  Go to Quick Start and manual setup
                </AppLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
