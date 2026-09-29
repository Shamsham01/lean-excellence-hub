import { NextResponse, type NextRequest } from "next/server";

import {
  loadLeanAiContextualSnapshot,
  recordLeanAiSemanticEvent,
} from "@/modules/leanai-context/queries";
import {
  isLeanAiModuleKey,
  isLeanAiSemanticEventKey,
} from "@/modules/leanai-context/taxonomy";
import { requestHasTrustedOrigin } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";

export async function GET() {
  try {
    const snapshot = await loadLeanAiContextualSnapshot();
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: "Unable to load LeanAI context." },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!requestHasTrustedOrigin(request, environment)) {
    return NextResponse.json({ error: "Untrusted origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  const eventKey = typeof record.eventKey === "string" ? record.eventKey : "";
  if (!isLeanAiSemanticEventKey(eventKey)) {
    return NextResponse.json(
      { error: "Event key is not in the bounded taxonomy." },
      { status: 400 },
    );
  }

  const moduleKey =
    typeof record.moduleKey === "string" && isLeanAiModuleKey(record.moduleKey)
      ? record.moduleKey
      : undefined;

  try {
    const result = await recordLeanAiSemanticEvent({
      eventKey,
      eventVersion:
        typeof record.eventVersion === "number" ? record.eventVersion : 1,
      ...(moduleKey ? { moduleKey } : {}),
      ...(typeof record.interventionKey === "string"
        ? { interventionKey: record.interventionKey }
        : {}),
      ...(typeof record.siteUnitId === "string"
        ? { siteUnitId: record.siteUnitId }
        : {}),
      metadata:
        record.metadata !== null &&
        typeof record.metadata === "object" &&
        !Array.isArray(record.metadata)
          ? (record.metadata as Record<
              string,
              string | number | boolean | null
            >)
          : {},
      ...(typeof record.occurredAt === "string"
        ? { occurredAt: record.occurredAt }
        : {}),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record LeanAI event.",
      },
      { status: 400 },
    );
  }
}
