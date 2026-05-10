import { NextResponse } from "next/server";
import {
  getWeeklyAttempt,
  loadProgress,
  markWeeklyComplete,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

function parseWeek(weekStr: string): 1 | 2 | 3 | 4 | null {
  const w = Number.parseInt(weekStr, 10);
  if (w !== 1 && w !== 2 && w !== 3 && w !== 4) return null;
  return w;
}

function weekDayRange(week: 1 | 2 | 3 | 4): [number, number] {
  return [(week - 1) * 7 + 1, week * 7];
}

async function isWeekUnlocked(week: 1 | 2 | 3 | 4): Promise<boolean> {
  const data = await loadProgress();
  const [first, last] = weekDayRange(week);
  for (let day = first; day <= last; day++) {
    if (!data.lessons[String(day)]) return false;
  }
  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const { week: weekStr } = await params;
  const week = parseWeek(weekStr);
  if (week === null) {
    return NextResponse.json({ error: "invalid week" }, { status: 400 });
  }
  const attempt = await getWeeklyAttempt(week);
  return NextResponse.json({ week, attempt });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const { week: weekStr } = await params;
  const week = parseWeek(weekStr);
  if (week === null) {
    return NextResponse.json({ error: "invalid week" }, { status: 400 });
  }

  // Server-side gate: all 7 lessons in the week must be marked complete
  // before we accept a review submission.
  if (!(await isWeekUnlocked(week))) {
    return NextResponse.json(
      { error: "week not unlocked — complete all 7 lessons first" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const score = Number(
    typeof body === "object" && body !== null && "score" in body
      ? (body as { score: unknown }).score
      : NaN,
  );
  const total = Number(
    typeof body === "object" && body !== null && "total" in body
      ? (body as { total: unknown }).total
      : NaN,
  );
  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: "invalid score" }, { status: 400 });
  }
  if (!Number.isFinite(total) || total <= 0 || total > 100) {
    return NextResponse.json({ error: "invalid total" }, { status: 400 });
  }
  if (score > total) {
    return NextResponse.json(
      { error: "score > total" },
      { status: 400 },
    );
  }

  const entry = await markWeeklyComplete(week, score, total);
  return NextResponse.json(entry);
}
