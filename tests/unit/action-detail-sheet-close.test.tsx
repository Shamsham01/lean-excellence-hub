import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionDetailSheet } from "@/components/actions/action-detail-sheet";
import { loadActionSheetPayload } from "@/app/(platform)/platform/actions/actions";

vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadActionSheetPayload: vi.fn(),
}));

const loadMock = vi.mocked(loadActionSheetPayload);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  loadMock.mockResolvedValue({ error: "not loaded in test" });
});

describe("ActionDetailSheet mobile close", () => {
  it("exposes back and close controls that dismiss the sheet", () => {
    const onOpenChange = vi.fn();
    render(
      <ActionDetailSheet
        actionId="action-1"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByTestId("action-detail-sheet-back"));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.click(screen.getByTestId("action-detail-sheet-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
