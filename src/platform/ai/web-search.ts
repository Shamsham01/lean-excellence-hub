import type { ExternalWebSource } from "@/modules/leanai-context/assistant/external-sources";
import { sanitiseExternalWebSources } from "@/modules/leanai-context/assistant/external-sources";

export const OPENAI_WEB_SEARCH_TOOL = {
  type: "web_search",
} as const;

export const WEB_SEARCH_TOOL_TYPES = new Set([
  "web_search",
  "web_search_2025_08_26",
]);

export const WEB_SEARCH_SOURCES_INCLUDE =
  "web_search_call.action.sources" as const;

export function workspaceAssistantTools(
  webSearchEnabled: boolean,
): Array<Record<string, unknown>> {
  return webSearchEnabled ? [{ ...OPENAI_WEB_SEARCH_TOOL }] : [];
}

export function providerToolsIncludeWebSearch(
  tools: Array<Record<string, unknown>>,
): boolean {
  return tools.some(
    (tool) =>
      typeof tool.type === "string" && WEB_SEARCH_TOOL_TYPES.has(tool.type),
  );
}

export function coachStructuredPayload(input: {
  envelope: Record<string, unknown>;
  externalSources: ExternalWebSource[];
}): Record<string, unknown> {
  if (input.externalSources.length === 0) {
    return input.envelope;
  }
  return {
    ...input.envelope,
    external_sources: sanitiseExternalWebSources(input.externalSources),
  };
}
