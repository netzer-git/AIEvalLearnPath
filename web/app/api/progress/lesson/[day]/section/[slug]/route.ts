import { NextResponse } from "next/server";
import { toggleSectionComplete } from "@/lib/progress";

export const dynamic = "force-dynamic";

const VALID_SLUG = /^[a-z0-9-]+$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ day: string; slug: string }> },
) {
  const { day: dayStr, slug } = await params;
  const day = Number.parseInt(dayStr, 10);
  if (Number.isNaN(day) || day < 1 || day > 28) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }
  if (!slug || !VALID_SLUG.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const completed = !!(
    typeof body === "object" && body !== null && "completed" in body
      ? (body as { completed: unknown }).completed
      : false
  );

  const result = await toggleSectionComplete(day, slug, completed);
  return NextResponse.json(result);
}
