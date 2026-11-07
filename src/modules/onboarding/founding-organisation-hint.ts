export type FoundingOrganisationDomainHintState =
  "none" | "possible_existing_organisation";

export function parseFoundingOrganisationDomainHint(
  payload: unknown,
): FoundingOrganisationDomainHintState {
  if (!payload || typeof payload !== "object") {
    return "none";
  }

  const state = (payload as Record<string, unknown>).state;
  if (state === "possible_existing_organisation") {
    return "possible_existing_organisation";
  }

  return "none";
}

export async function loadFoundingOrganisationDomainHint(
  rpc: () => Promise<{ data: unknown; error: unknown }>,
): Promise<FoundingOrganisationDomainHintState> {
  const { data, error } = await rpc();
  if (error) {
    return "none";
  }

  return parseFoundingOrganisationDomainHint(data);
}
