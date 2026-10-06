"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ContextualHelpTopic =
  | "organisational-unit"
  | "parent-unit"
  | "unit-type"
  | "unit-code"
  | "job-function"
  | "application-role"
  | "access-scope"
  | "primary-organisational-unit";

const helpContent: Record<
  ContextualHelpTopic,
  { title: string; body: string }
> = {
  "organisational-unit": {
    title: "Organisation unit",
    body: "An organisation unit is a place or team in your structure — for example a department, area, line, or ward. Units keep stable identifiers. Archive instead of delete so history is preserved.",
  },
  "parent-unit": {
    title: "Parent unit",
    body: "The parent unit sits above this unit in your hierarchy. Top level is the root of the organisation, typically a site. Nested units belong to the parent you select.",
  },
  "unit-type": {
    title: "Unit type",
    body: "A short label that describes what kind of unit this is, such as department, area, team, or line. Sites, plants, factories and locations are billable security boundaries and are not a routine type on this page.",
  },
  "unit-code": {
    title: "Unit code",
    body: "The unit code is a stable identifier generated from the unit name. You can edit it before creating the unit. After creation it cannot be changed.",
  },
  "job-function": {
    title: "Job function",
    body: "A job function describes what someone does at work — for example Production Operator or Quality Manager. It helps organise training and capability. It does not grant application permissions on its own.",
  },
  "application-role": {
    title: "Application role",
    body: "An application role controls what someone can do in Lean Excellence Hub — such as managing programmes, reviewing suggestions, or administering settings. This is separate from their job function.",
  },
  "access-scope": {
    title: "Access scope",
    body: "Access scope limits where an application role applies. Entire organisation covers permitted work across all sites. A specific site stays local to that site unless the person is granted access elsewhere. Job titles do not grant access on their own.",
  },
  "primary-organisational-unit": {
    title: "Primary organisation unit",
    body: "The primary unit is someone's main work area in your organisation. It is used when they submit improvement ideas, appear in directories, and access scoped features.",
  },
};

type ContextualHelpProps = {
  topic: ContextualHelpTopic;
  className?: string;
  label?: string;
};

export function ContextualHelp({
  topic,
  className,
  label = "Help",
}: ContextualHelpProps) {
  const [open, setOpen] = useState(false);
  const content = helpContent[topic];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "inline-flex h-8 gap-1 px-2 text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${content.title}`}
        data-testid={`contextual-help-${topic}`}
      >
        <HelpCircle className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">{content.title}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{content.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-foreground">
              {content.body}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Need more guidance later? Lean AI setup assistance can be added here
            in a future release.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContextualHelpLabel({
  topic,
  children,
}: {
  topic: ContextualHelpTopic;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <ContextualHelp topic={topic} />
    </span>
  );
}
