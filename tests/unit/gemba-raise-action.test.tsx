import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GembaAuditRaiseAction } from "@/components/gemba/gemba-audit-raise-action";
import {
  createGembaPlannerAction,
  loadActionCreateContext,
} from "@/app/(platform)/platform/actions/actions";

vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadActionCreateContext: vi.fn(),
  createPlannerAction: vi.fn(),
  createFiveSPlannerAction: vi.fn(),
  createGembaPlannerAction: vi.fn(),
  initiateActionEvidenceUpload: vi.fn(),
  confirmActionEvidenceUpload: vi.fn(),
}));

const linkContext = {
  walkId: "walk-1",
  observationId: "obs-1",
  defaultTitle: "Oil on floor near line 2",
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(loadActionCreateContext).mockResolvedValue({
    labels: [],
    assignablePeople: [],
    canManageLabels: false,
  });
  vi.mocked(createGembaPlannerAction).mockResolvedValue({
    ok: true,
    id: "action-gemba",
  });
});

describe("GembaAuditRaiseAction", () => {
  it("opens create dialog wired to gemba link context", () => {
    const onActionCreated = vi.fn();
    render(
      <GembaAuditRaiseAction
        linkContext={linkContext}
        actionCount={0}
        onActionCreated={onActionCreated}
      />,
    );

    fireEvent.click(screen.getByTestId("gemba-raise-action"));
    expect(screen.getByTestId("actions-create-dialog")).toBeVisible();
    expect(
      screen.getByDisplayValue("Oil on floor near line 2"),
    ).toBeInTheDocument();
  });
});
