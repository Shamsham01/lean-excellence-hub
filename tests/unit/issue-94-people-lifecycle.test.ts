import { describe, expect, it } from "vitest";

import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import { responsibilityScopeLabel } from "@/modules/rbac2/responsibilities";
import { mapWorkforceImportProgressFromDatabase } from "@/modules/workforce-import/constants";

const exeterSiteId = "site-exeter";
const bodminSiteId = "site-bodmin";

const units: FlatOrganisationUnit[] = [
  {
    id: exeterSiteId,
    code: "exeter",
    name: "Exeter",
    unit_type: "site",
    parent_unit_id: null,
  },
  {
    id: "exeter-ops",
    code: "ex-ops",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: exeterSiteId,
  },
  {
    id: bodminSiteId,
    code: "bodmin",
    name: "Bodmin",
    unit_type: "site",
    parent_unit_id: null,
  },
  {
    id: "bodmin-ops",
    code: "bo-ops",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: bodminSiteId,
  },
];

describe("issue #94 people lifecycle helpers", () => {
  it("disambiguates duplicate scope labels with unit path", () => {
    expect(
      responsibilityScopeLabel({
        scope_type: "unit_subtree",
        scope_unit_name: "Operations",
        scope_unit_path: "Exeter › Operations",
      }),
    ).toBe("Exeter › Operations subtree");
  });

  it("filters delegatable offers to the active site subtree", () => {
    const context: ActiveSiteContext = {
      mode: "site",
      activeSiteId: exeterSiteId,
      locked: false,
      sites: [
        { id: exeterSiteId, name: "Exeter", code: "exeter" },
        { id: bodminSiteId, name: "Bodmin", code: "bodmin" },
      ],
    };

    const filtered = filterDelegatableOffersForActiveSite(
      [
        {
          role_version_id: "role-1",
          role_display_name: "Team Member",
          role_canonical_name: "team_member",
          scope_options: [
            {
              scope_type: "unit_subtree",
              scope_unit_id: "exeter-ops",
              label: "Exeter › Operations subtree",
            },
            {
              scope_type: "unit_subtree",
              scope_unit_id: "bodmin-ops",
              label: "Bodmin › Operations subtree",
            },
          ],
        },
      ],
      units,
      context,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.scope_options).toHaveLength(1);
    expect(filtered[0]?.scope_options[0]?.scope_unit_id).toBe("exeter-ops");
  });

  it("maps export session fields from database progress payloads", () => {
    const progress = mapWorkforceImportProgressFromDatabase({
      status: "completed",
      total_rows: 2,
      valid_rows: 2,
      error_rows: 0,
      warning_rows: 0,
      provisioned_rows: 2,
      failed_rows: 0,
      remediation_rows: 0,
      remaining_rows: 0,
      credential_export_status: "exporting",
      credential_expires_at: "2026-09-21T12:00:00.000Z",
      credential_export_session_id: "session-123",
      credential_export_session_started_at: "2026-09-21T11:45:00.000Z",
      completed_at: "2026-09-21T11:40:00.000Z",
      archived_from_recent_at: null,
    });

    expect(progress.credentialExportStatus).toBe("exporting");
    expect(progress.credentialExportSessionId).toBe("session-123");
  });
});
