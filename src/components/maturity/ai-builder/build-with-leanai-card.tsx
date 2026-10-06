import { MessagesSquare, Sparkles } from "lucide-react";

import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MaturityBuilderAccess } from "@/modules/maturity/ai-builder/load";
import { MATURITY_BUILDER_ROUTE } from "@/modules/maturity/ai-builder/types";

/** Entry point only. Opening the builder never calls a model. */
export function BuildWithLeanAiCard({
  access,
  hasConversation,
}: {
  access: MaturityBuilderAccess;
  hasConversation: boolean;
}) {
  return (
    <Card
      className="overflow-hidden border-border bg-card shadow-sm"
      data-testid="maturity-build-with-leanai-card"
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="information">
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            LeanAI
          </Badge>
          <Badge variant="outline">Guided conversation</Badge>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-semibold tracking-tight">
            Translate your own operating system into a framework
          </h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Describe what you assess and how you define maturity. LeanAI asks a
            few questions, proposes levels, pillars, criteria and scored
            questions in your language, and you refine them before anything is
            saved.
          </p>
        </div>
        <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-3">
          <li className="flex gap-2">
            <MessagesSquare
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            Short discovery, not a blank page
          </li>
          <li className="flex gap-2">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            Review and refine every part
          </li>
          <li className="flex gap-2">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            Creates an editable draft only
          </li>
        </ul>
        {access.available ? (
          <div>
            <Button asChild>
              <AppLink
                href={MATURITY_BUILDER_ROUTE}
                data-testid="maturity-build-with-leanai"
              >
                {hasConversation ? "Continue with LeanAI" : "Build with LeanAI"}
              </AppLink>
            </Button>
          </div>
        ) : (
          <p
            className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            data-testid="maturity-build-with-leanai-unavailable"
          >
            {access.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
