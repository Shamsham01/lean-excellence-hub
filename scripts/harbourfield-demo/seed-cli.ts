#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { runHarbourfieldTopUp } from "./apply-top-up";
import { HARBOURFIELD_USERS } from "./constants";
import { ensureLocalHarbourfieldFoundation } from "./foundation";
import {
  assertHarbourfieldHostedTopUpAllowed,
  assertHarbourfieldLocalCommandAllowed,
  parseHarbourfieldDemoArgs,
  resolveHarbourfieldHostedCredentials,
} from "./guards";
import { loadLocalSupabaseEnv } from "./local-env";
import { resolveHarbourfieldOrganisation } from "./resolve-org";

async function signInWithEmail(
  apiUrl: string,
  publishableKey: string,
  email: string,
  password: string,
) {
  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw (
      error ??
      new Error(`Unable to sign in ${email} for Harbourfield demo top-up.`)
    );
  }

  return client;
}

async function main() {
  const args = parseHarbourfieldDemoArgs(process.argv.slice(2));

  if (args.target === "hosted") {
    const credentials = resolveHarbourfieldHostedCredentials();
    assertHarbourfieldHostedTopUpAllowed({
      apiUrl: credentials.apiUrl,
      expectedProjectRef: credentials.expectedProjectRef,
      organisationCode: credentials.organisationCode,
      mode: args.mode,
    });

    const adminClient = await signInWithEmail(
      credentials.apiUrl,
      credentials.publishableKey,
      credentials.adminEmail,
      credentials.adminPassword,
    );

    const organisation = await resolveHarbourfieldOrganisation(
      adminClient,
      credentials.organisationId
        ? { organisationId: credentials.organisationId }
        : undefined,
    );

    const result = await runHarbourfieldTopUp({
      apiUrl: credentials.apiUrl,
      publishableKey: credentials.publishableKey,
      organisation,
      mode: args.mode,
    });

    console.log(result.planText);
    if (args.mode === "apply") {
      console.log("");
      console.log("Harbourfield hosted demo top-up apply complete.");
    }
    return;
  }

  const lifecycleEvent = args.apply
    ? "demo:harbourfield:top-up"
    : "demo:harbourfield:top-up:dry-run";
  const env = loadLocalSupabaseEnv(lifecycleEvent);
  assertHarbourfieldLocalCommandAllowed(env.apiUrl, lifecycleEvent);

  const serviceAdmin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let adminClient = await signInWithEmail(
    env.apiUrl,
    env.publishableKey,
    HARBOURFIELD_USERS.admin.email,
    HARBOURFIELD_USERS.admin.password,
  ).catch(() => null);

  let organisation = null as Awaited<
    ReturnType<typeof resolveHarbourfieldOrganisation>
  > | null;

  if (adminClient) {
    try {
      organisation = await resolveHarbourfieldOrganisation(adminClient);
    } catch {
      organisation = null;
    }
  }

  if (!organisation) {
    const provision =
      process.env.LEANHUB_HARBOURFIELD_PROVISION_LOCAL !== "0" &&
      args.mode === "apply";

    if (!provision) {
      throw new Error(
        "Harbourfield organisation is not available for dry-run. Run `npm run demo:harbourfield:top-up` once to provision local foundation, or set LEANHUB_HARBOURFIELD_PROVISION_LOCAL=0 only when the org already exists.",
      );
    }

    console.log(
      "Harbourfield organisation missing — provisioning local foundation...",
    );
    await ensureLocalHarbourfieldFoundation({
      admin: serviceAdmin,
      apiUrl: env.apiUrl,
      publishableKey: env.publishableKey,
    });

    adminClient = await signInWithEmail(
      env.apiUrl,
      env.publishableKey,
      HARBOURFIELD_USERS.admin.email,
      HARBOURFIELD_USERS.admin.password,
    );
    organisation = await resolveHarbourfieldOrganisation(adminClient);
  }

  const result = await runHarbourfieldTopUp({
    apiUrl: env.apiUrl,
    publishableKey: env.publishableKey,
    organisation,
    mode: args.mode,
  });

  console.log(result.planText);

  if (args.mode === "apply") {
    console.log("");
    console.log("Harbourfield local demo top-up apply complete.");
    console.log(`Organisation: ${organisation.name} (${organisation.code})`);
    console.log(
      "Logins (local only): admin@harbourfield.local / manager@harbourfield.local / operator@harbourfield.local",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
