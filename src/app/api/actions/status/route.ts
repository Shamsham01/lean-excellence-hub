import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  completeAction,
  reopenAction,
  transitionActionStatus,
} from "@/app/(platform)/platform/actions/actions";
import { requestHasTrustedOrigin } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";

const inputSchema = z.object({
  actionId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  fromStatus: z.enum(["open", "in_progress", "completed", "cancelled"]),
  toStatus: z.enum(["open", "in_progress", "completed"]),
});

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request, getServerEnvironment())) {
    return NextResponse.json({ error: "Untrusted origin." }, { status: 403 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action status update." },
      { status: 400 },
    );
  }
  const { actionId, expectedVersion, fromStatus, toStatus } = parsed.data;
  const input = { actionId, expectedVersion };
  // All authorisation and optimistic concurrency checks stay in the existing RPC.
  const result =
    toStatus === "completed"
      ? await completeAction(input)
      : toStatus === "open" &&
          (fromStatus === "completed" || fromStatus === "cancelled")
        ? await reopenAction(input)
        : await transitionActionStatus({ ...input, toStatus });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
