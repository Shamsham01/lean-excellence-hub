import { describe, expect, it } from "vitest";

import {
  mergeServerAndChatPendingProposals,
  syncSessionPendingProposals,
} from "@/lib/problem-solving/sync-session-pending-proposals";

describe("syncSessionPendingProposals", () => {
  it("replaces client snapshot with pending rows only", () => {
    const rows = syncSessionPendingProposals([
      {
        id: "a",
        proposal_type: "hypothesis",
        payload_json: { statement: "x" },
        human_explanation: "h1",
        status: "pending",
      },
      {
        id: "b",
        proposal_type: "hypothesis",
        payload_json: { statement: "y" },
        human_explanation: "h2",
        status: "accepted",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("a");
  });
});

describe("mergeServerAndChatPendingProposals", () => {
  it("dedupes by id and prefers the latest chat row", () => {
    const merged = mergeServerAndChatPendingProposals(
      [
        {
          id: "p1",
          proposal_type: "hypothesis",
          payload_json: { statement: "old" },
          human_explanation: "server",
          status: "pending",
          ai_session_id: "s1",
        },
      ],
      [
        {
          id: "p1",
          proposal_type: "hypothesis",
          payload_json: { statement: "new" },
          human_explanation: "chat",
          status: "pending",
          ai_session_id: "s1",
        },
        {
          id: "p2",
          proposal_type: "containment",
          payload_json: { description: "c" },
          human_explanation: "chat2",
          status: "pending",
          ai_session_id: "s1",
        },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((row) => row.id === "p1")?.human_explanation).toBe(
      "chat",
    );
  });

  it("drops non-pending chat rows", () => {
    const merged = mergeServerAndChatPendingProposals(
      [],
      [
        {
          id: "stale",
          proposal_type: "hypothesis",
          payload_json: {},
          human_explanation: "gone",
          status: "superseded",
          ai_session_id: "s1",
        },
      ],
    );
    expect(merged).toHaveLength(0);
  });
});
