import type { BenefitSourceLinkSummary } from "@/lib/benefits/types";

type SourceLinkContext = {
  project_number?: string | null;
  suggestion_number?: string | null;
  title?: string | null;
};

function contextFromUnknown(value: unknown): SourceLinkContext | null {
  if (!value || typeof value !== "object") return null;
  return value as SourceLinkContext;
}

export function benefitSourceDisplayLabel(
  link: BenefitSourceLinkSummary,
): string {
  if (link.display_label?.trim()) {
    return link.display_label.trim();
  }

  const context = contextFromUnknown(link.context);
  if (context?.project_number?.trim()) {
    return context.project_number.trim();
  }
  if (context?.suggestion_number?.trim()) {
    return context.suggestion_number.trim();
  }
  if (link.title?.trim()) {
    return link.title.trim();
  }

  return link.resource_type.replaceAll("_", " ");
}

export function benefitSourceHref(
  link: BenefitSourceLinkSummary,
): string | null {
  if (link.href?.trim()) {
    return link.href.trim();
  }

  return null;
}
