"use client";

import { useState, useTransition } from "react";

import { useSerializedSetupSave } from "@/components/skills/setup/serialized-save";

import {
  createSkillsDraftFromProposal,
  saveSkillsSetupPreparation,
  sendSkillsSetupBuilderMessage,
  startNewSkillsSetup,
} from "@/app/(platform)/platform/skills/setup/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SkillsBuilderProposal } from "@/modules/skills/ai-builder/types";
import type { QuickStartPreparation } from "@/modules/skills/setup/preparation";
import {
  skillsSetupSelectClass,
  skillsSetupWrappingTextClass,
  type SkillsSetupUnitOption,
} from "@/modules/skills/setup/unit-options";

type Named = { id: string; name: string };

export function SkillsBuilderPanel({
  initial,
  initialProposal = null,
  initialProposalMessageId = null,
  jobFunctions,
  units,
  unavailableMessage,
}: {
  initial: QuickStartPreparation;
  initialProposal?: SkillsBuilderProposal | null;
  initialProposalMessageId?: string | null;
  jobFunctions: Named[];
  units: SkillsSetupUnitOption[];
  unavailableMessage: string | null;
}) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SkillsBuilderProposal | null>(
    initialProposal,
  );
  const [proposalMessageId, setProposalMessageId] = useState<string | null>(
    initialProposalMessageId,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enqueue = useSerializedSetupSave();

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
          <Button
            className="w-full max-w-full whitespace-normal sm:w-auto"
            asChild
          >
            <AppLink href="/platform/skills/setup/manual">
              Continue manually
            </AppLink>
          </Button>
          <Button
            variant="outline"
            className="w-full max-w-full whitespace-normal sm:w-auto"
            asChild
          >
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

  function applyTurn(
    result: Awaited<ReturnType<typeof sendSkillsSetupBuilderMessage>>,
  ) {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReply(result.message);
    if (result.proposal) {
      setProposal(result.proposal);
      setProposalMessageId(result.proposalMessageId);
      setMessage("");
      setError(result.issues.length > 0 ? result.issues.join(" ") : null);
      return;
    }
    setProposal(null);
    setProposalMessageId(null);
    setError(
      result.issues.length > 0
        ? result.issues.join(" ")
        : "LeanAI did not return a proposal. Retry, or describe the operation again.",
    );
  }

  function persist(next: QuickStartPreparation) {
    setState(next);
    startTransition(async () => {
      await enqueue(async () => {
        const result = await saveSkillsSetupPreparation({
          source: "leanai",
          templateKey: "leanai-skills-builder",
          state: next,
        });
        if ("error" in result && result.error) {
          setError(result.error);
        }
      });
    });
  }

  return (
    <div
      className="flex w-full max-w-full min-w-0 flex-col gap-6"
      data-testid="skills-builder"
    >
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
          <p
            className={`text-sm font-medium ${skillsSetupWrappingTextClass}`}
            data-testid="skills-builder-proposal-title"
          >
            {proposal.title}
          </p>
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
            {roles.map((role) => {
              const selectedId =
                state.roleMappings.find(
                  (mapping) => mapping.suggestedRole === role,
                )?.jobFunctionId ?? "";
              return (
                <label
                  key={role}
                  className="grid w-full max-w-full min-w-0 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <span className={skillsSetupWrappingTextClass}>{role}</span>
                  <select
                    className={skillsSetupSelectClass}
                    data-testid={`skills-builder-map-${role}`}
                    value={selectedId}
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
                  {selectedId ? (
                    <span
                      className={`sm:col-start-2 ${skillsSetupWrappingTextClass}`}
                      data-testid={`skills-selected-${role}`}
                    >
                      {
                        jobFunctions.find(
                          (jobFunction) => jobFunction.id === selectedId,
                        )?.name
                      }
                    </span>
                  ) : null}
                </label>
              );
            })}
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
                data-testid="skills-builder-units"
                checked={state.applicability === "units"}
                onChange={() => persist({ ...state, applicability: "units" })}
              />
              Only selected units
            </label>
            {state.applicability === "units" ? (
              <div
                className="flex w-full max-w-full min-w-0 flex-col gap-2"
                data-testid="skills-unit-list"
              >
                {units.map((unit) => (
                  <label
                    key={unit.id}
                    className="flex min-h-11 w-full max-w-full min-w-0 items-start gap-2 py-2 pl-6 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0"
                      checked={state.unitIds.includes(unit.id)}
                      onChange={(event) => {
                        const unitIds = event.target.checked
                          ? [...state.unitIds, unit.id]
                          : state.unitIds.filter((id) => id !== unit.id);
                        persist({ ...state, unitIds });
                      }}
                    />
                    <span className={skillsSetupWrappingTextClass}>
                      {unit.path}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
          <Button
            type="button"
            className="w-full max-w-full whitespace-normal sm:w-auto"
            data-testid="skills-builder-create"
            disabled={pending || !proposalMessageId}
            onClick={() => {
              if (!proposalMessageId || pending) {
                return;
              }
              const data = new FormData();
              data.set("proposalMessageId", proposalMessageId);
              startTransition(async () => {
                await enqueue(async () => {
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
          className="w-full max-w-full min-w-0"
          data-testid="skills-builder-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm" role="alert" data-testid="skills-builder-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          data-testid="skills-builder-send"
          disabled={pending || message.trim().length === 0}
          onClick={() => {
            if (pending) {
              return;
            }
            startTransition(async () => {
              await enqueue(async () => {
                applyTurn(
                  await sendSkillsSetupBuilderMessage({
                    message,
                    intent: "propose",
                    idempotencyKey: crypto.randomUUID(),
                  }),
                );
              });
            });
          }}
        >
          {proposal ? "Refine proposal" : "Ask LeanAI for a proposal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          data-testid="skills-builder-retry"
          disabled={pending || message.trim().length === 0}
          onClick={() => {
            if (pending) {
              return;
            }
            startTransition(async () => {
              await enqueue(async () => {
                applyTurn(
                  await sendSkillsSetupBuilderMessage({
                    message,
                    intent: "retry",
                    idempotencyKey: crypto.randomUUID(),
                  }),
                );
              });
            });
          }}
        >
          Retry
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          data-testid="skills-start-new-setup"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await enqueue(async () => {
                const result = await startNewSkillsSetup({
                  source: "leanai",
                  templateKey: "leanai-skills-builder",
                  state,
                });
                if ("error" in result && result.error) {
                  setError(result.error);
                  return;
                }
                if ("preparation" in result) {
                  setState(result.preparation);
                }
              });
            });
          }}
        >
          Start a new setup
        </Button>
      </div>
    </div>
  );
}
