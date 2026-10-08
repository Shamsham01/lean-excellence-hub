import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { MODULE_SETUP_COPY } from "@/modules/module-setup/copy";
import { moduleSetupReadiness } from "@/modules/module-setup/readiness";

type ModuleSetupChooserProps = {
  moduleLabel: string;
  configurationNoun: "standard" | "definition";
  existingCount: number;
  manualHref: string;
  quickStartHref: string;
  leanAiHref: string;
  canManage: boolean;
  leanAiMessage: string | null;
  quickStartSummary: string;
};

export function ModuleSetupChooser({
  moduleLabel,
  configurationNoun,
  existingCount,
  manualHref,
  quickStartHref,
  leanAiHref,
  canManage,
  leanAiMessage,
  quickStartSummary,
}: ModuleSetupChooserProps) {
  const readiness = moduleSetupReadiness(existingCount);
  const copy = MODULE_SETUP_COPY;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="module-setup-heading"
      data-testid="module-setup-chooser"
    >
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {moduleLabel}
        </p>
        <h1
          id="module-setup-heading"
          className="text-3xl font-semibold tracking-tight text-balance"
        >
          {copy.heading}
        </h1>
        <p className="text-base text-muted-foreground">{copy.principle}</p>
        <p className="text-sm text-muted-foreground">
          {readiness.entry === "first"
            ? `There is no ${configurationNoun} yet. Each path creates a draft you own.`
            : `You already have ${readiness.existingCount} ${configurationNoun}${readiness.existingCount === 1 ? "" : "s"}. A new one is still a draft until you publish it.`}
        </p>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground" role="status">
          You need permission to manage {moduleLabel.toLowerCase()} before
          creating a {configurationNoun}.
        </p>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          <Choice
            testId="module-setup-mode-manual"
            index="01"
            mode={copy.manual.mode}
            title={copy.manual.title}
            description={copy.manual.description}
            href={manualHref}
            action={copy.manual.action}
            emphasis="secondary"
          />
          <Choice
            testId="module-setup-mode-quick-start"
            index="02"
            mode={copy.quickStart.mode}
            title={copy.quickStart.title}
            description={copy.quickStart.description}
            meta={quickStartSummary}
            href={quickStartHref}
            action={copy.quickStart.action}
            emphasis="primary"
          />
          <Choice
            testId="module-setup-mode-leanai"
            index="03"
            mode={copy.leanAi.mode}
            title={copy.leanAi.title}
            description={copy.leanAi.description}
            meta={leanAiMessage ?? copy.authority}
            href={leanAiHref}
            action={copy.leanAi.action}
            emphasis="secondary"
          />
        </ol>
      )}

      <p className="text-sm text-muted-foreground">
        {copy.path}. {copy.authority}
      </p>
    </section>
  );
}

function Choice({
  testId,
  index,
  mode,
  title,
  description,
  meta,
  href,
  action,
  emphasis,
}: {
  testId: string;
  index: string;
  mode: string;
  title: string;
  description: string;
  meta?: string;
  href: string;
  action: string;
  emphasis: "primary" | "secondary";
}) {
  return (
    <li className="grid gap-4 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6">
      <div className="flex items-baseline gap-3 sm:block">
        <p className="font-mono text-xs text-muted-foreground">{index}</p>
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase sm:mt-2">
          {mode}
        </p>
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {meta ? (
          <p
            className="mt-2 text-sm text-foreground/80"
            data-testid={`${testId}-meta`}
          >
            {meta}
          </p>
        ) : null}
      </div>
      <Button
        variant={emphasis === "primary" ? "default" : "outline"}
        className="min-h-11 w-full sm:w-auto"
        asChild
      >
        <AppLink href={href} data-testid={testId}>
          {action}
        </AppLink>
      </Button>
    </li>
  );
}
