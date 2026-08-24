import { getPublicEnvironment } from "@/platform/env";

export default function Home() {
  getPublicEnvironment();

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm sm:p-12">
        <p className="mb-3 font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Application baseline
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Lean Excellence Hub
        </h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          The application and development-tooling foundation is ready for the
          secure tenant foundation planned for the next approved milestone.
        </p>
      </section>
    </main>
  );
}
