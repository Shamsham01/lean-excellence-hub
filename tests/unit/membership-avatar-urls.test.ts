/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpcMock = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

describe("loadMembershipAvatarUrls", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("maps avatar URLs from get_people_directory", async () => {
    rpcMock.mockResolvedValue({
      data: {
        people: [
          {
            membership_id: "m-1",
            avatar_url: "https://cdn.test/a.png",
          },
          {
            membership_id: "m-2",
            avatar_url: null,
          },
        ],
        total_count: 2,
        page: 1,
        page_size: 100,
      },
      error: null,
    });

    const { loadMembershipAvatarUrls } = await import(
      "@/lib/people/membership-avatar-urls"
    );
    const map = await loadMembershipAvatarUrls(["m-1", "m-2"]);

    expect(rpcMock).toHaveBeenCalledWith("get_people_directory", {
      target_search: null,
      target_page: 1,
      target_page_size: 100,
      target_include_inactive: false,
    });
    expect(map.get("m-1")).toBe("https://cdn.test/a.png");
    expect(map.get("m-2")).toBeNull();
  });

  it("logs and returns partial results when the directory RPC fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "people directory is not authorised" },
    });

    const { loadMembershipAvatarUrls } = await import(
      "@/lib/people/membership-avatar-urls"
    );
    const map = await loadMembershipAvatarUrls(["m-9"]);

    expect(map.get("m-9")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[loadMembershipAvatarUrls] get_people_directory failed",
      "people directory is not authorised",
    );
    errorSpy.mockRestore();
  });
});
