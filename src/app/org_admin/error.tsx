"use client";

export default function PlatformOwnerError() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
      <p className="text-sm text-muted-foreground">Refresh and try again.</p>
    </div>
  );
}
