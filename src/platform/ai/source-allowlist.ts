import type { TypedSourceRef } from "@/platform/ai/types";

export type SourceAllowlist = Set<string>;

export function sourceRefKey(ref: TypedSourceRef): string | null {
  for (const [key, value] of Object.entries(ref)) {
    if (value) return `${key}:${value}`;
  }
  return null;
}

export function createSourceAllowlist(): SourceAllowlist {
  return new Set<string>();
}

export function addToAllowlist(
  allowlist: SourceAllowlist,
  ref: TypedSourceRef,
): void {
  const key = sourceRefKey(ref);
  if (key) allowlist.add(key);
}

export function filterAllowedSourceRefs(
  allowlist: SourceAllowlist,
  refs: Array<{ label: string; ref: TypedSourceRef }>,
): Array<{ label: string; ref: TypedSourceRef }> {
  return refs.filter((item) => {
    const key = sourceRefKey(item.ref);
    return key ? allowlist.has(key) : false;
  });
}

export function toDbSourceRef(
  ref: TypedSourceRef,
): Record<string, string | null> {
  return {
    problem_solving_case_id: ref.problem_solving_case_id ?? null,
    current_condition_item_id: ref.current_condition_item_id ?? null,
    containment_id: ref.containment_id ?? null,
    hypothesis_id: ref.hypothesis_id ?? null,
    hypothesis_test_id: ref.hypothesis_test_id ?? null,
    countermeasure_id: ref.countermeasure_id ?? null,
    effectiveness_check_id: ref.effectiveness_check_id ?? null,
    sustainment_item_id: ref.sustainment_item_id ?? null,
    problem_solving_session_id: ref.problem_solving_session_id ?? null,
    action_id: ref.action_id ?? null,
    lesson_learned_id: ref.lesson_learned_id ?? null,
  };
}
