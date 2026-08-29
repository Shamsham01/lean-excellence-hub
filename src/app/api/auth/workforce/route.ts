import { NextResponse } from "next/server";

import { authenticateWorkforce } from "@/modules/identity/workforce-login";
import { requestHasTrustedOrigin } from "@/platform/application-origin";
import { getServerEnvironment } from "@/platform/env";

export async function POST(request: Request) {
  const environment = getServerEnvironment();
  if (!requestHasTrustedOrigin(request, environment)) {
    return NextResponse.json(
      { error: "Unable to sign in with those credentials." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const sourceIp = environment.TRUSTED_PROXY_IP_HEADER
    ? request.headers.get(environment.TRUSTED_PROXY_IP_HEADER)
    : null;
  const result = await authenticateWorkforce(
    {
      organisationCode: formData.get("organisationCode"),
      password: formData.get("password"),
      workforceAlias: formData.get("workforceAlias"),
    },
    sourceIp,
  );

  const target = result.ok ? result.next : "/workforce-login?error=invalid";
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
