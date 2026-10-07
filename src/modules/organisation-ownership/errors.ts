import { toCustomerErrorMessage } from "@/modules/people/customer-errors";

const FALLBACK =
  "Ownership could not be transferred. No change was made. You can try again.";

export function toOwnershipTransferErrorMessage(error: unknown) {
  const mapped = toCustomerErrorMessage(error, FALLBACK);
  if (mapped !== FALLBACK) {
    return mapped;
  }

  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: string }).message)
      : "";
  const normalised = raw.toLowerCase();

  if (normalised.includes("not authorised")) {
    return "Only the current organisation owner can transfer ownership.";
  }
  if (normalised.includes("not eligible")) {
    return "Choose an active member of this organisation. Invite them first if they are not yet a member.";
  }
  if (normalised.includes("current owner")) {
    return "Choose a different person. You already hold organisation ownership.";
  }
  if (normalised.includes("no owner")) {
    return "Ownership was not changed because the organisation would have been left without an owner.";
  }

  return FALLBACK;
}
