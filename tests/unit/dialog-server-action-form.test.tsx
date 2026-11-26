import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { DialogServerActionForm } from "@/components/ui/dialog-server-action-form";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("DialogServerActionForm", () => {
  it("disables the submit control while saving and does not refresh by default", async () => {
    let resolveAction: () => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const onSuccess = vi.fn();

    render(
      <DialogServerActionForm action={action} onSuccess={onSuccess}>
        <Button type="submit">Save</Button>
      </DialogServerActionForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });
    expect(action).toHaveBeenCalledTimes(1);

    resolveAction();
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("allows callers without server invalidation to opt into refreshing", async () => {
    render(
      <DialogServerActionForm action={async () => {}} refreshOnSuccess>
        <Button type="submit">Save</Button>
      </DialogServerActionForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
