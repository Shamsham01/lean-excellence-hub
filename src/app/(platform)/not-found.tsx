export default function PlatformNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-2 px-6 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The requested resource is unavailable or you do not have access.
      </p>
    </div>
  );
}
