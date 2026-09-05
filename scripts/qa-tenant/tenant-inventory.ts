import { collectTenantInventoryViaSql } from "./tenant-inventory-sql";

type InventorySection = {
  title: string;
  items: Array<{ label: string; count: number | null }>;
};

export function buildTenantInventoryFromSqlPayload(
  payload: Awaited<ReturnType<typeof collectTenantInventoryViaSql>>,
) {
  if (!payload.organisation) {
    return {
      organisation: null,
      sections: [] as InventorySection[],
    };
  }

  const counts = payload.counts;

  const sections: InventorySection[] = [
    {
      title: "Foundation",
      items: [
        { label: "memberships", count: Number(counts.memberships ?? 0) },
        { label: "organisational units", count: Number(counts.units ?? 0) },
        { label: "role grants", count: Number(counts.role_grants ?? 0) },
      ],
    },
    {
      title: "Maturity",
      items: [
        { label: "frameworks", count: Number(counts.maturity_models ?? 0) },
        {
          label: "assessments",
          count: Number(counts.maturity_assessments ?? 0),
        },
        { label: "evidence", count: Number(counts.maturity_evidence ?? 0) },
      ],
    },
    {
      title: "5S",
      items: [
        { label: "standards", count: Number(counts.five_s_standards ?? 0) },
        { label: "audits", count: Number(counts.five_s_audits ?? 0) },
      ],
    },
    {
      title: "Gemba",
      items: [
        { label: "definitions", count: Number(counts.gemba_definitions ?? 0) },
        { label: "walks", count: Number(counts.gemba_walks ?? 0) },
      ],
    },
    {
      title: "Scheduling",
      items: [
        {
          label: "definitions",
          count: Number(counts.schedule_definitions ?? 0),
        },
        {
          label: "occurrences",
          count: Number(counts.schedule_occurrences ?? 0),
        },
      ],
    },
    {
      title: "Training",
      items: [
        { label: "courses", count: Number(counts.training_courses ?? 0) },
        { label: "sessions", count: Number(counts.training_sessions ?? 0) },
        {
          label: "completions",
          count: Number(counts.training_completions ?? 0),
        },
        { label: "job functions", count: Number(counts.job_functions ?? 0) },
      ],
    },
    {
      title: "Skills",
      items: [
        {
          label: "proficiency assessments",
          count: Number(counts.skill_assessments ?? 0),
        },
      ],
    },
    {
      title: "Suggestions",
      items: [{ label: "suggestions", count: Number(counts.suggestions ?? 0) }],
    },
    {
      title: "Recognition",
      items: [
        { label: "awards", count: Number(counts.recognition_awards ?? 0) },
      ],
    },
    {
      title: "Projects",
      items: [{ label: "ci projects", count: Number(counts.ci_projects ?? 0) }],
    },
    {
      title: "Benefits",
      items: [
        { label: "benefits", count: Number(counts.benefits ?? 0) },
        { label: "forecasts", count: Number(counts.benefit_forecasts ?? 0) },
        {
          label: "realisation entries",
          count: Number(counts.benefit_realisations ?? 0),
        },
      ],
    },
    {
      title: "Problem Solving",
      items: [
        {
          label: "cases",
          count: Number(counts.problem_solving_cases ?? 0),
        },
      ],
    },
    {
      title: "AI",
      items: [{ label: "sessions", count: Number(counts.ai_sessions ?? 0) }],
    },
    {
      title: "Shared Platform",
      items: [
        { label: "actions", count: Number(counts.actions ?? 0) },
        { label: "templates", count: Number(counts.templates ?? 0) },
        { label: "attachments", count: Number(counts.attachments ?? 0) },
        { label: "comments", count: Number(counts.comments ?? 0) },
        {
          label: "storage objects (organisation-evidence)",
          count: Number(counts.storage_objects ?? 0),
        },
      ],
    },
  ];

  return {
    organisation: payload.organisation,
    sections,
  };
}

export function collectTenantInventory(
  databaseUrl: string,
  organisationCode: string,
) {
  const payload = collectTenantInventoryViaSql(databaseUrl, organisationCode);
  return buildTenantInventoryFromSqlPayload(payload);
}

export function formatTenantInventoryReport(
  inventory: ReturnType<typeof collectTenantInventory>,
  title: string,
) {
  const lines: string[] = [];

  lines.push(title);

  if (!inventory.organisation) {
    lines.push("Organisation: not provisioned");
    return lines.join("\n");
  }

  lines.push(`Organisation: ${inventory.organisation.name}`);
  lines.push(`Code: ${inventory.organisation.code}`);
  lines.push(`UUID: ${inventory.organisation.id}`);
  lines.push("");

  for (const section of inventory.sections) {
    lines.push(section.title);
    for (const item of section.items) {
      lines.push(`  - ${item.label}: ${item.count ?? "n/a"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function countTenantModuleRows(
  inventory: ReturnType<typeof collectTenantInventory>,
) {
  if (!inventory.organisation) {
    return 0;
  }

  const moduleSections = inventory.sections.filter(
    (section) => section.title !== "Foundation",
  );

  return moduleSections.reduce(
    (sum, section) =>
      sum +
      section.items.reduce(
        (sectionSum, item) => sectionSum + Number(item.count ?? 0),
        0,
      ),
    0,
  );
}
