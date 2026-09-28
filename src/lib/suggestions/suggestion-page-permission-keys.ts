import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";

export const suggestionsOverviewPermissionKeys = [
  SUGGESTIONS_PERMISSIONS.read,
  SUGGESTIONS_PERMISSIONS.submit,
  SUGGESTIONS_PERMISSIONS.review,
  SUGGESTIONS_PERMISSIONS.programmesManage,
  SUGGESTIONS_PERMISSIONS.manage,
] as const;

export const suggestionsReviewPermissionKeys = [
  SUGGESTIONS_PERMISSIONS.review,
  SUGGESTIONS_PERMISSIONS.manage,
] as const;
