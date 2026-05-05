import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

export type LessonProgress = {
  completed_at: string; // ISO timestamp of first completion
  reading_seconds: number; // seconds spent on the lesson when first marked complete
};

/**
 * Per-section completion: a map of section slug → ISO timestamp at which
 * the user marked that section complete. Section slugs are derived from
 * H2 text by markdown.ts's slugify().
 */
export type SectionsForDay = Record<string, string>;

export type ProgressData = {
  lessons: Record<string, LessonProgress>;
  sections: Record<string, SectionsForDay>;
};

const EMPTY: ProgressData = { lessons: {}, sections: {} };

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PROGRESS_FILE);
  } catch {
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(EMPTY, null, 2), "utf-8");
  }
}

export async function loadProgress(): Promise<ProgressData> {
  try {
    await ensureFile();
    const raw = await fs.readFile(PROGRESS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      lessons: parsed.lessons ?? {},
      sections: parsed.sections ?? {},
    };
  } catch {
    return { lessons: {}, sections: {} };
  }
}

export async function getLessonProgress(day: number): Promise<LessonProgress | null> {
  const data = await loadProgress();
  return data.lessons[String(day)] ?? null;
}

export async function markLessonComplete(
  day: number,
  readingSeconds: number,
): Promise<LessonProgress> {
  const data = await loadProgress();
  const key = String(day);
  // Only record on first completion. Re-completion doesn't overwrite the
  // first reading_seconds — the curriculum-feedback signal we care about
  // is "how long did this take the first time you did it."
  const existing = data.lessons[key];
  if (existing) return existing;

  const entry: LessonProgress = {
    completed_at: new Date().toISOString(),
    reading_seconds: Math.max(0, Math.round(readingSeconds)),
  };
  data.lessons[key] = entry;
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), "utf-8");
  return entry;
}

export async function toggleSectionComplete(
  day: number,
  slug: string,
  completed: boolean,
): Promise<{ completed: boolean; at: string | null }> {
  const data = await loadProgress();
  const dayKey = String(day);
  if (!data.sections[dayKey]) data.sections[dayKey] = {};

  let at: string | null = null;
  if (completed) {
    at = new Date().toISOString();
    data.sections[dayKey][slug] = at;
  } else {
    delete data.sections[dayKey][slug];
    if (Object.keys(data.sections[dayKey]).length === 0) {
      delete data.sections[dayKey];
    }
  }

  await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), "utf-8");
  return { completed, at };
}
