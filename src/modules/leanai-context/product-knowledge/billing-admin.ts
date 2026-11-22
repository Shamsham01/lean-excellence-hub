import {
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE = "src/modules/billing and /platform/settings/billing";

const billingFields: PlatformKnowledgeField[] = [
  {
    name: "Subscribed site capacity",
    identifier: "site_capacity",
    purpose: "Limits how many billable sites the organisation may activate.",
    required: "required",
    constraints: "Purchasing capacity does not create sites automatically.",
    example: "Capacity 3, two active sites",
    mistakes: "Expecting LeanAI to purchase capacity or create sites.",
    dependencies: "Structure settings create sites after capacity exists.",
    permissions:
      "billing.manage to view and change subscription-facing settings.",
    lifecycle:
      "Capacity changes through billing flows handled by organisation owners.",
    consequences: "Cannot activate a site without available capacity.",
    setupSteps: "Settings → Billing → adjust capacity → Structure → add site.",
  },
  {
    name: "Organisation ownership transfer",
    identifier: "ownership_transfer",
    purpose: "Moves legal control to another active member.",
    required: "optional",
    constraints: "Only through Settings → Organisation → Transfer ownership.",
    example: "Transfer to existing admin",
    mistakes:
      "Assuming transfer reassigns every site admin grant automatically.",
    dependencies: "Target must already be an active member.",
    permissions: "Organisation owner role; not granted by LeanAI.",
    lifecycle: "One-way explicit confirmation flow.",
    consequences: "Does not migrate personal profiles across organisations.",
    setupSteps: "Organisation settings → Transfer ownership → confirm.",
  },
];

export const BILLING_ADMIN_AUDITED_FIELD_IDENTIFIERS = [
  "site_capacity",
  "ownership_transfer",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "billing_administration",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const BILLING_ADMIN_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] =
  [
    {
      id: "billing_admin.overview",
      module: "billing_administration",
      title: "Billing and organisation administration",
      workflows: ["billing_settings", "organisation_settings"],
      routePrefixes: [
        "/platform/settings/billing",
        "/platform/settings/organisation",
      ],
      purpose:
        "Subscription capacity, billing visibility, and ownership boundaries.",
      intendedUsers: "Organisation owners and billing administrators.",
      facts: [
        "LeanAI does not read payment instruments, charge cards, or change plans.",
        "Answers about invoices or entitlements must not be invented from Skills or Problem Solving bundles.",
        "Platform Owner Console is separate from tenant billing settings.",
        "When detail is missing, LeanAI states the gap instead of fabricating screens.",
      ],
      fields: billingFields,
      provenance: provenance("billing_admin.overview", "billing_settings"),
    },
  ];

export function billingAdminKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    BILLING_ADMIN_AUDITED_FIELD_IDENTIFIERS,
    BILLING_ADMIN_KNOWLEDGE_ARTICLES,
  );
}

export function billingAdminKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, BILLING_ADMIN_KNOWLEDGE_ARTICLES);
}

export function billingAdminFieldGaps(): string[] {
  return billingAdminKnowledgeFieldGaps();
}
