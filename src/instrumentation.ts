import { onRequestError as logRequestError } from "@/platform/observability/request-error";

export async function onRequestError(
  ...args: Parameters<typeof logRequestError>
) {
  await logRequestError(...args);
}
