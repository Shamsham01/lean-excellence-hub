import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Provider is unavailable." },
    { status: 404 },
  );
}
