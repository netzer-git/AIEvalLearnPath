import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    return NextResponse.json(
      { error: "auth-not-configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const passcode =
    typeof body === "object" && body !== null && "passcode" in body
      ? (body as { passcode: unknown }).passcode
      : null;

  if (typeof passcode !== "string" || passcode !== expected) {
    return NextResponse.json({ error: "invalid-passcode" }, { status: 401 });
  }

  const session = await getSession();
  session.authenticated = true;
  await session.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
