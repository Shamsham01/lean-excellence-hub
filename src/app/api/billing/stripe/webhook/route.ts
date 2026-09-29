import { NextResponse } from "next/server";

import { BillingConfigurationError } from "@/modules/billing/env";
import { getBillingProvider } from "@/modules/billing/get-provider";
import { BillingProviderError } from "@/modules/billing/provider";
import { processBillingWebhook } from "@/modules/billing/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const result = await processBillingWebhook({
      provider: getBillingProvider(),
      payload,
      signature,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (cause) {
    if (cause instanceof BillingConfigurationError) {
      return NextResponse.json(
        { error: "billing_unavailable" },
        { status: 503 },
      );
    }

    if (
      cause instanceof BillingProviderError &&
      cause.code === "invalid_webhook"
    ) {
      return NextResponse.json({ error: "invalid_webhook" }, { status: 400 });
    }

    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}
