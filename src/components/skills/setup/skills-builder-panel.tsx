"use client";

import { useState, useTransition } from "react";

import {
  createSkillsDraftFromProposal,
  saveSkillsSetupPreparation,
  sendSkillsSetupBuilderMessage,
} from "@/app/(platform)/platform/skills/setup/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SkillsBuilderProposal } from "@/modules/skills/ai-builder/types";
import type { QuickStartPreparation } from "@/modules/skills/setup/preparation";

type Named = { id: string; name: string };

export function SkillsBuilderPanel({
  initial,
  jobFunctions,
  units,
  unavailableMessage,
}: {
  initial: QuickStartPreparation;
  jobFunctions: Named[];
  units: Named[];
  unavailableMessage: string | null;
}) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SkillsBuilderProposal | null>(null);
  const [proposalMessageId, setProposalMessageId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (unavailableMessage) {
    return (
      <section
        className="flex max-w-2xl flex-col gap-3"
        data-testid="skills-builder-unavailable"
      >
        <p className="text-sm">{unavailableMessage}</p>
        <p className="text-sm text-muted-foreground">
          Manual setup and LEH Quick Start remain available.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" asChild>
            <AppLink href="/platform/skills/setup/manual">
              Continue manually
            </AppLink>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <AppLink href="/platform/skills/setup/quick-start">
              Use Quick Start
            </AppLink>
          </Button>
        </div>
      </section>
    );
  }

  const roles = [
    ...new Set(
      proposal?.requirements.map((item) => item.suggestedJobFunction) ?? [],
    ),
  ];

  function persist(next: QuickStartPreparation) {
    setState(next);
    startTransition(async () => {
      const result = await saveSkillsSetupPreparation({
        source: "leanai",
        templateKey: "leanai-skills-builder",
        state: next,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="skills-builder">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Describe the operation and the abilities people must demonstrate. LeanAI
        will ask only what changes the setup. It will not publish, assess
        anyone, or choose where a requirement applies.
      </p>
      {reply ? <p className="max-w-3xl text-sm">{reply}</p> : null}
      {proposal ? (
        <section
          className="flex flex-col gap-3"
          data-testid="skills-builder-proposal"
        >
          <h2 className="text-lg font-medium">Proposed setup — not applied</h2>
          <p className="text-sm">
            {proposal.scale.name}:{" "}
            {proposal.scale.levels.map((level) => level.label).join(", ")}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {proposal.skills.map((skill) => (
              <li key={skill.name}>{skill.name}</li>
            ))}
          </ul>
          <fieldset
            className="flex flex-col gap-2"
            data-testid="skills-builder-mapping"
          >
            <legend className="text-sm font-medium">
              Confirm job functions
            </legend>
            {roles.map((role) => (
              <label key={role} className="grid gap-2 text-sm sm:grid-cols-2">
                {role}
                <select
                  className="border-input h-10 min-w-0 rounded-md border bg-background px-3"
                  value={
                    state.roleMappings.find(
                      (mapping) => mapping.suggestedRole === role,
                    )?.jobFunctionId ?? ""
                  }
                  onChange={(event) => {
                    const jobFunctionId = event.target.value || null;
                    const existing = state.roleMappings.some(
                      (mapping) => mapping.suggestedRole === role,
                    );
                    const roleMappings = existing
                      ? state.roleMappings.map((mapping) =>
                          mapping.suggestedRole === role
                            ? { ...mapping, jobFunctionId }
                            : mapping,
                        )
                      : [
                          ...state.roleMappings,
                          { suggestedRole: role, jobFunctionId },
                        ];
                    persist({ ...state, roleMappings });
                  }}
                >
                  <option value="">Leave unresolved</option>
                  {jobFunctions.map((jobFunction) => (
                    <option key={jobFunction.id} value={jobFunction.id}>
                      {jobFunction.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                checked={state.applicability === "organisation"}
                onChange={() =>
                  persist({
                    ...state,
                    applicability: "organisation",
                    unitIds: [],
                  })
                }
              />
              Apply confirmed requirements wherever the job function is used
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                checked={state.applicability === "units"}
                onChange={() => persist({ ...state, applicability: "units" })}
              />
              Only selected units
            </label>
            {state.applicability === "units"
              ? units.map((unit) => (
                  <label
                    key={unit.id}
                    className="flex items-start gap-2 pl-6 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={state.unitIds.includes(unit.id)}
                      onChange={(event) => {
                        const unitIds = event.target.checked
                          ? [...state.unitIds, unit.id]
                          : state.unitIds.filter((id) => id !== unit.id);
                        persist({ ...state, unitIds });
                      }}
                    />
                    {unit.name}
                  </label>
                ))
              : null}
          </fieldset>
          <Button
            type="button"
            className="w-full sm:w-auto"
            data-testid="skills-builder-create"
            disabled={pending || !proposalMessageId}
            onClick={() => {
              if (!proposalMessageId || pending) {
                return;
              }
              const data = new FormData();
              data.set("proposalMessageId", proposalMessageId);
              startTransition(async () => {
                const saved = await saveSkillsSetupPreparation({
                  source: "leanai",
                  templateKey: "leanai-skills-builder",
                  state,
                });
                if ("error" in saved && saved.error) {
                  setError(saved.error);
                  return;
                }
                const result = await createSkillsDraftFromProposal(data);
                if (result && "error" in result && result.error) {
                  setError(result.error);
                }
              });
            }}
          >
            Create setup draft
          </Button>
        </section>
      ) : null}
      <label
        className="flex flex-col gap-2 text-sm"
        htmlFor="skills-builder-message"
      >
        Describe the operation
        <Textarea
          id="skills-builder-message"
          data-testid="skills-builder-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="w-full sm:w-auto"
        data-testid="skills-builder-send"
        disabled={pending || message.trim().length === 0}
        onClick={() => {
          if (pending) {
            return;
          }
          startTransition(async () => {
            const result = await sendSkillsSetupBuilderMessage({
              message,
              intent: "propose",
              idempotencyKey: crypto.randomUUID(),
            });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setReply(result.message);
            setProposal(result.proposal);
            setProposalMessageId(result.proposalMessageId);
            setMessage("");
            if (result.issues.length > 0) {
              setError(result.issues.join(" "));
            }
          });
        }}
      >
        {proposal ? "Refine proposal" : "Ask LeanAI for a proposal"}
      </Button>
    </div>
  );
}
