import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useDialogDefaultOpen } from "@/components/ui/use-dialog-default-open";

const moduleWriteAllowed = vi.hoisted(() => ({ value: true }));
vi.mock("@/modules/billing/module-write-context", () => ({
  usePlanModuleWriteAllowed: () => moduleWriteAllowed.value,
}));

function DialogWithDefaultOpen({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useDialogDefaultOpen(defaultOpen);
  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Default open probe"
      testId="default-open-dialog"
    >
      <p data-testid="default-open-body">Form body</p>
    </ResponsiveFormDialog>
  );
}

describe("useDialogDefaultOpen", () => {
  afterEach(() => {
    moduleWriteAllowed.value = true;
    cleanup();
  });

  it("opens when defaultOpen and plan writes are allowed", async () => {
    render(<DialogWithDefaultOpen defaultOpen />);
    await waitFor(() => {
      expect(screen.getByTestId("default-open-body")).toBeVisible();
    });
  });

  it("stays closed when defaultOpen but plan writes are blocked", async () => {
    moduleWriteAllowed.value = false;
    render(<DialogWithDefaultOpen defaultOpen />);
    await waitFor(() => {
      expect(screen.queryByTestId("default-open-body")).not.toBeInTheDocument();
    });
  });
});
