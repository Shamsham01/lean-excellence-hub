"use server";

import { revalidatePath } from "next/cache";

import {
  PROFILE_AVATAR_BUCKET,
  inferAvatarExtension,
  profileAvatarObjectPath,
} from "@/lib/profile/avatar-storage";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function mapProfileAvatarStorageError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("bucket")) {
    return "Profile photo storage is not available yet. Ask your administrator to apply the profile-avatars migration.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("policy") ||
    lower.includes("not authorized")
  ) {
    return "You are not allowed to upload this profile photo.";
  }
  if (
    lower.includes("file size") ||
    lower.includes("payload too large") ||
    lower.includes("too large")
  ) {
    return "Photos must be between 1 byte and 2 MB.";
  }
  if (
    lower.includes("mime") ||
    lower.includes("content type") ||
    lower.includes("invalid file type")
  ) {
    return "Use a JPEG, PNG, or WebP photo.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Unable to reach profile photo storage. Try again.";
  }
  return "Unable to upload your profile photo.";
}

function revalidateProfileSurfaces() {
  revalidatePath("/platform/settings/profile");
  revalidatePath("/platform");
  revalidatePath("/platform/setup");
  revalidatePath("/platform/people");
}

export async function updateProfileDisplayName(displayName: string) {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (!userId) {
    return { error: "You must be signed in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", userId);

  if (error) {
    if (error.code === "42501") {
      return { error: "You are not authorised to update your profile." };
    }
    return { error: "Unable to update your profile." };
  }

  revalidateProfileSurfaces();

  return { ok: true as const };
}

export async function uploadProfileAvatar(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (!userId) {
    return { error: "You must be signed in to update your profile photo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose a photo to upload." };
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return { error: "Photos must be between 1 byte and 2 MB." };
  }

  const extension = inferAvatarExtension(file.type);
  if (!extension) {
    return { error: "Use a JPEG, PNG, or WebP photo." };
  }

  const objectPath = profileAvatarObjectPath(userId, extension);
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(objectPath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: mapProfileAvatarStorageError(uploadError.message) };
  }

  const { data: publicUrlData } = supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .getPublicUrl(objectPath);

  const avatarUrl = publicUrlData.publicUrl;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("user_id", userId);

  if (profileError) {
    return { error: "Unable to save your profile photo." };
  }

  revalidateProfileSurfaces();
  return { ok: true as const, avatarUrl };
}

export async function removeProfileAvatar() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (!userId) {
    return { error: "You must be signed in to update your profile photo." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", userId);

  if (profileError) {
    return { error: "Unable to remove your profile photo." };
  }

  if (profile?.avatar_url) {
    for (const extension of ["jpg", "png", "webp"] as const) {
      await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .remove([profileAvatarObjectPath(userId, extension)]);
    }
  }

  revalidateProfileSurfaces();
  return { ok: true as const };
}
