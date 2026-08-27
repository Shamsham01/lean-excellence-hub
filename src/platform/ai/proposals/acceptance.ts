import "server-only";

import { PROBLEM_SOLVING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiProposalType } from "@/platform/ai/types";
import { proposalPayloadSchemas } from "@/platform/ai/proposals/contracts";

async function requirePermission(permission: string): Promise<void> {
  const allowed = await currentMemberHasPermission(permission);
  if (!allowed) {
    throw new Error("You do not have permission to accept this proposal.");
  }
}

export async function acceptAiProposal(
  supabase: SupabaseClient,
  proposalId: string,
  editedPayload: Record<string, unknown>,
): Promise<{ resultId: string; resultType: AiProposalType }> {
  const { data: proposalRows, error: loadError } = await supabase
    .from("ai_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposalRows) {
    throw new Error("Proposal not found or inaccessible.");
  }

  const proposal = proposalRows as {
    id: string;
    status: string;
    proposal_type: AiProposalType;
    problem_solving_case_id: string;
    ai_session_id: string;
    ai_run_id: string;
  };

  if (proposal.status !== "pending") {
    throw new Error("This proposal is no longer pending.");
  }

  const caseId = proposal.problem_solving_case_id;

  switch (proposal.proposal_type) {
    case "current_condition_item": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.contribute);
      const cc =
        proposalPayloadSchemas.current_condition_item.parse(editedPayload);
      const { data: ccId, error: ccError } = await supabase.rpc(
        "create_current_condition_item",
        {
          target_case_id: caseId,
          target_category: cc.category,
          target_statement: cc.statement,
        },
      );
      if (ccError) throw ccError;
      await recordAcceptance(supabase, proposal, {
        current_condition_item_id: ccId as string,
      });
      return { resultId: ccId as string, resultType: proposal.proposal_type };
    }

    case "hypothesis": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const hyp = proposalPayloadSchemas.hypothesis.parse(editedPayload);
      const { data: hypId, error: hypError } = await supabase.rpc(
        "create_hypothesis",
        {
          target_problem_solving_case_id: caseId,
          target_statement: hyp.statement,
          target_category: hyp.category ?? null,
          target_rationale: hyp.rationale ?? null,
          target_parent_hypothesis_id: hyp.parent_hypothesis_id ?? null,
        },
      );
      if (hypError) throw hypError;
      await recordAcceptance(supabase, proposal, {
        hypothesis_id: hypId as string,
      });
      return { resultId: hypId as string, resultType: proposal.proposal_type };
    }

    case "hypothesis_test": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const test = proposalPayloadSchemas.hypothesis_test.parse(editedPayload);
      await assertHypothesisInCase(supabase, caseId, test.hypothesis_id);
      const { data: testId, error: testError } = await supabase.rpc(
        "create_hypothesis_test",
        {
          target_hypothesis_id: test.hypothesis_id,
          target_test_question: test.test_question,
          target_expected_result: test.expected_result,
          target_method: test.method ?? null,
        },
      );
      if (testError) throw testError;
      await recordAcceptance(supabase, proposal, {
        hypothesis_test_id: testId as string,
      });
      return { resultId: testId as string, resultType: proposal.proposal_type };
    }

    case "containment": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const cont = proposalPayloadSchemas.containment.parse(editedPayload);
      const { data: contId, error: contError } = await supabase.rpc(
        "create_containment",
        {
          target_problem_solving_case_id: caseId,
          target_description: cont.description,
          target_rationale: cont.rationale ?? null,
        },
      );
      if (contError) throw contError;
      await recordAcceptance(supabase, proposal, {
        containment_id: contId as string,
      });
      return { resultId: contId as string, resultType: proposal.proposal_type };
    }

    case "countermeasure": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const cm = proposalPayloadSchemas.countermeasure.parse(editedPayload);
      const { data: cmId, error: cmError } = await supabase.rpc(
        "create_countermeasure",
        {
          target_case_id: caseId,
          target_title: cm.title,
          target_description: cm.description ?? null,
          target_rationale: cm.rationale ?? null,
        },
      );
      if (cmError) throw cmError;
      if (cm.hypothesis_ids?.length) {
        for (const hypothesisId of cm.hypothesis_ids) {
          await assertHypothesisInCase(supabase, caseId, hypothesisId);
        }
        await supabase.rpc("link_countermeasure_causes", {
          target_countermeasure_id: cmId,
          target_hypothesis_ids: cm.hypothesis_ids,
        });
      }
      await recordAcceptance(supabase, proposal, {
        countermeasure_id: cmId as string,
      });
      return { resultId: cmId as string, resultType: proposal.proposal_type };
    }

    case "universal_action": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const act = proposalPayloadSchemas.universal_action.parse(editedPayload);
      const { data: actId, error: actError } = await supabase.rpc(
        "create_problem_solving_action",
        {
          target_title: act.title,
          target_problem_solving_case_id: caseId,
          target_context_role: act.context_role,
          target_description: act.description ?? null,
        },
      );
      if (actError) throw actError;
      await recordAcceptance(supabase, proposal, {
        action_id: actId as string,
      });
      return { resultId: actId as string, resultType: proposal.proposal_type };
    }

    case "effectiveness_check": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const eff =
        proposalPayloadSchemas.effectiveness_check.parse(editedPayload);
      const { data: effId, error: effError } = await supabase.rpc(
        "create_effectiveness_check",
        {
          target_case_id: caseId,
          target_criterion: eff.criterion,
          target_baseline_description: eff.baseline_description ?? null,
          target_target_description: eff.target_description ?? null,
        },
      );
      if (effError) throw effError;
      await recordAcceptance(supabase, proposal, {
        effectiveness_check_id: effId as string,
      });
      return { resultId: effId as string, resultType: proposal.proposal_type };
    }

    case "sustainment_item": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const sus = proposalPayloadSchemas.sustainment_item.parse(editedPayload);
      const { data: susId, error: susError } = await supabase.rpc(
        "create_sustainment_item",
        {
          target_case_id: caseId,
          target_what: sus.what,
          target_check_method: sus.check_method ?? null,
        },
      );
      if (susError) throw susError;
      await recordAcceptance(supabase, proposal, {
        sustainment_item_id: susId as string,
      });
      return { resultId: susId as string, resultType: proposal.proposal_type };
    }

    case "session_question": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.contribute);
      const sq = proposalPayloadSchemas.session_question.parse(editedPayload);
      await assertSessionInCase(supabase, caseId, sq.session_id);
      const { data: sqId, error: sqError } = await supabase.rpc(
        "add_session_entry",
        {
          target_session_id: sq.session_id,
          target_entry_type: "question",
          target_body: sq.body,
        },
      );
      if (sqError) throw sqError;
      await recordAcceptance(supabase, proposal, {
        session_entry_id: sqId as string,
      });
      return { resultId: sqId as string, resultType: proposal.proposal_type };
    }

    case "session_summary": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.contribute);
      const ss = proposalPayloadSchemas.session_summary.parse(editedPayload);
      await assertSessionInCase(supabase, caseId, ss.session_id);
      const { data: ssId, error: ssError } = await supabase.rpc(
        "add_session_entry",
        {
          target_session_id: ss.session_id,
          target_entry_type: "note",
          target_body: ss.body,
        },
      );
      if (ssError) throw ssError;
      await recordAcceptance(supabase, proposal, {
        session_entry_id: ssId as string,
      });
      return { resultId: ssId as string, resultType: proposal.proposal_type };
    }

    case "lessons_learned": {
      await requirePermission(PROBLEM_SOLVING_PERMISSIONS.manage);
      const ll = proposalPayloadSchemas.lessons_learned.parse(editedPayload);
      const { data: llId, error: llError } = await supabase.rpc(
        "create_problem_solving_lessons_learned",
        {
          target_case_id: caseId,
          target_what_happened: ll.what_happened,
          target_what_learned: ll.what_learned,
          target_standardise: ll.standardise ?? null,
          target_apply_elsewhere: ll.apply_elsewhere ?? null,
          target_notes: ll.notes ?? null,
        },
      );
      if (llError) throw llError;
      await recordAcceptance(supabase, proposal, {
        lesson_learned_id: llId as string,
      });
      return { resultId: llId as string, resultType: proposal.proposal_type };
    }

    default:
      throw new Error("Unsupported proposal type.");
  }
}

async function recordAcceptance(
  supabase: SupabaseClient,
  proposal: { id: string },
  resultRef: Record<string, string>,
): Promise<void> {
  const { error } = await supabase.rpc("record_ai_proposal_accepted", {
    target_ai_proposal_id: proposal.id,
    target_current_condition_item_id:
      resultRef.current_condition_item_id ?? undefined,
    target_containment_id: resultRef.containment_id ?? undefined,
    target_hypothesis_id: resultRef.hypothesis_id ?? undefined,
    target_hypothesis_test_id: resultRef.hypothesis_test_id ?? undefined,
    target_countermeasure_id: resultRef.countermeasure_id ?? undefined,
    target_effectiveness_check_id:
      resultRef.effectiveness_check_id ?? undefined,
    target_sustainment_item_id: resultRef.sustainment_item_id ?? undefined,
    target_problem_solving_session_id:
      resultRef.problem_solving_session_id ?? undefined,
    target_session_entry_id: resultRef.session_entry_id ?? undefined,
    target_action_id: resultRef.action_id ?? undefined,
    target_lesson_learned_id: resultRef.lesson_learned_id ?? undefined,
  });
  if (error) throw error;
}

async function assertHypothesisInCase(
  supabase: SupabaseClient,
  caseId: string,
  hypothesisId: string,
) {
  const { data, error } = await supabase
    .from("problem_solving_hypotheses")
    .select("id")
    .eq("id", hypothesisId)
    .eq("problem_solving_case_id", caseId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Referenced hypothesis is not valid for this case.");
  }
}

async function assertSessionInCase(
  supabase: SupabaseClient,
  caseId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("problem_solving_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Referenced session is not valid for this case.");
  }
}
