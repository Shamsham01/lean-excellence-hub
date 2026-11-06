export const PROFILE_AVATAR_BUCKET = "profile-avatars";

export function profileAvatarObjectPath(userId: string, extension: string) {
  return `${userId}/avatar.${extension}`;
}

export function inferAvatarExtension(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}
