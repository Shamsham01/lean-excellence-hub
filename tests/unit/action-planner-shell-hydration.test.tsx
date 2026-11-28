import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform/actions",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadPlannerCardDetails: vi.fn(async () => []),
}));
vi.mock("@/components/actions/action-create-form", () => ({
  ActionCreateDialog: () => null,
}));

import { ActionPlannerShell } from "@/components/actions/action-planner-shell";

afterEach(cleanup);

it("server-renders toolbar controls disabled so pre-hydration taps are not dropped", () => {
  const html = renderToString(<ActionPlannerShell actions={[]} canCreate />);
  const container = document.createElement("div");
  container.innerHTML = html;
  const addNew = container.querySelector('[data-testid="actions-add-new"]');
  expect(addNew).not.toBeNull();
  expect(addNew).toHaveProperty("disabled", true);
  for (const id of ["list", "board"]) {
    const tab = container.querySelector(`[data-testid="actions-view-${id}"]`);
    expect(tab).toHaveProperty("disabled", true);
  }
});

it("enables Add new and view tabs once mounted on the client", () => {
  render(<ActionPlannerShell actions={[]} canCreate />);
  expect(screen.getByTestId("actions-add-new")).toHaveProperty(
    "disabled",
    false,
  );
  expect(screen.getByTestId("actions-view-board")).toHaveProperty(
    "disabled",
    false,
  );
});
