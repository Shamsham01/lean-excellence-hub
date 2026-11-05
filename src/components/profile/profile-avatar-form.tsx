"use client";

import { useRef, useState, type ChangeEvent } from "react";

import {
  removeProfileAvatar,
  uploadProfileAvatar,
} from "@/app/(platform)/platform/settings/profile/actions";
import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { Button } from "@/components/ui/button";

type ProfileAvatarFormProps = {
  displayName: string;
  initialAvatarUrl: string | null;
};

export function ProfileAvatarForm({
  displayName,
  initialAvatarUrl,
}: ProfileAvatarFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadProfileAvatar(formData);
    setBusy(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.avatarUrl) {
      setAvatarUrl(result.avatarUrl);
      setMessage("Profile photo updated.");
    }
  }

  async function handleRemove() {
    setBusy(true);
    setMessage(null);
    const result = await removeProfileAvatar();
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setAvatarUrl(null);
    setMessage("Profile photo removed.");
  }

  return (
    <div className="flex flex-col gap-3" data-testid="profile-avatar-form">
      <div className="flex flex-wrap items-center gap-4">
        <PlatformMemberAvatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          size="md"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Upload photo
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          data-testid="profile-avatar-input"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, or WebP up to 2&nbsp;MB. Shown in the platform header and
        sidebar when set.
      </p>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
