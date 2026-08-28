import Link from "next/link";

import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();

  if (claims.data?.claims?.sub) {
    await routeAfterAuthentication();
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <p className="typography-product-identity">Lean Excellence Hub</p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Continuous improvement, built for operational excellence
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Lean Excellence Hub helps organisations run their Lean system in one
            place — from maturity and daily management to projects, people
            capability, and measurable benefits.
          </p>
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">
              Sign in with your organisation account to access your Lean system.
            </p>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              Improvement system
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Maturity, 5S, Gemba, actions, CI projects, benefits, suggestions,
              and structured problem solving.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              People and capability
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Training, skills, recognition, and workforce capability profiles
              aligned to how your organisation works.
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm sm:col-span-2 lg:col-span-1">
            <h2 className="text-base font-semibold text-foreground">
              Secure by design
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Multi-organisation access, role-based permissions, and tenant
              isolation for enterprise operational teams.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
