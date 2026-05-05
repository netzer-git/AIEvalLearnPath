import { NextResponse } from "next/server";
import { loadProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadProgress();
  return NextResponse.json(data);
}
