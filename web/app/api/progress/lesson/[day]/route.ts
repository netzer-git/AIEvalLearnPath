import { NextResponse } from "next/server";
import { markLessonComplete } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ day: string }> },
) {
  const { day: dayStr } = await params;
  const day = Number.parseInt(dayStr, 10);
  if (Number.isNaN(day) || day < 1 || day > 28) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const seconds = Number(
    typeof body === "object" && body !== null && "reading_seconds" in body
      ? (body as { reading_seconds: unknown }).reading_seconds
      : 0,
  );
  if (!Number.isFinite(seconds) || seconds < 0) {
    return NextResponse.json({ error: "invalid reading_seconds" }, { status: 400 });
  }
  const entry = await markLessonComplete(day, seconds);
  return NextResponse.json(entry);
}
