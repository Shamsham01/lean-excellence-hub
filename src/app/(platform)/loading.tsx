export default function PlatformLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading page…</span>
      <div className="h-8 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-xl border border-border bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
