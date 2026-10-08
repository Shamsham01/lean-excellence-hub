import type { ReactNode } from "react";

import { MODULE_SETUP_COPY } from "@/modules/module-setup/copy";

export type QuickStartPreviewSection = {
  name: string;
  description: string;
  items: Array<{ prompt: string; typeLabel?: string; guidance?: string }>;
};

export function QuickStartPreview({
  name,
  description,
  notes,
  counts,
  sections,
  deploy,
}: {
  name: string;
  description: string;
  notes: string;
  counts: Array<{ label: string; value: string }>;
  sections: QuickStartPreviewSection[];
  deploy: ReactNode;
}) {
  return (
    <article
      className="flex flex-col gap-8"
      data-testid="module-setup-quick-start-preview"
    >
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          LEH Quick Start
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {name}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          {description}
        </p>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {counts.map((count) => (
            <div key={count.label}>
              <dt className="text-muted-foreground">{count.label}</dt>
              <dd className="font-semibold tabular-nums">{count.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{notes}</p>
      </header>

      <div className="flex flex-col gap-6">
        {sections.map((section, index) => (
          <section key={section.name} className="border-t border-border pt-4">
            <h2 className="text-base font-semibold">
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
            <ol className="mt-3 flex flex-col gap-3">
              {section.items.map((item) => (
                <li
                  key={item.prompt}
                  className="min-w-0 text-sm leading-6 break-words"
                >
                  <p>{item.prompt}</p>
                  {item.typeLabel ? (
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      {item.typeLabel}
                    </p>
                  ) : null}
                  {item.guidance ? (
                    <p className="text-muted-foreground">{item.guidance}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section
        className="border-t border-border pt-6"
        aria-labelledby="deploy-heading"
      >
        <h2 id="deploy-heading" className="text-lg font-semibold">
          Create an editable draft
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {MODULE_SETUP_COPY.draftBoundary} You choose where it applies.
        </p>
        <div className="mt-4">{deploy}</div>
      </section>
    </article>
  );
}
