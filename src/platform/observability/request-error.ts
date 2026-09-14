import {
  isNextNavigationError,
  logPlatformBoundaryError,
  readErrorDigest,
  sanitizeBoundaryMessage,
} from "@/platform/observability/platform-boundary";

type InstrumentationRequest = Readonly<{
  path: string;
  method: string;
  headers: NodeJS.Dict<string | string[]>;
}>;

type InstrumentationContext = Readonly<{
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?:
    | "react-server-components"
    | "react-server-components-payload"
    | "server-rendering";
  revalidateReason: "on-demand" | "stale" | undefined;
}>;

export async function onRequestError(
  error: unknown,
  request: InstrumentationRequest,
  context: InstrumentationContext,
) {
  if (isNextNavigationError(error)) {
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";

  logPlatformBoundaryError({
    category: "request",
    operation: context.routeType,
    reference: readErrorDigest(error) ?? "unsigned",
    route: request.path,
    digest: readErrorDigest(error),
    supabaseMessage: sanitizeBoundaryMessage(message),
    routeType: context.routeType,
    renderSource: context.renderSource ?? null,
  });
}
