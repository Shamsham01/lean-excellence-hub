import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import { accept } from "./actions";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims?.sub) {
    redirect(`/login?next=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  return (
    <main>
      <h1>Accept invitation</h1>
      {error ? <p role="alert">This invitation is unavailable.</p> : null}
      <p>Accepting will apply the sealed role and scope offered to you.</p>
      <form action={accept}>
        <input type="hidden" name="token" value={token} />
        <button type="submit">Accept invitation</button>
      </form>
    </main>
  );
}
