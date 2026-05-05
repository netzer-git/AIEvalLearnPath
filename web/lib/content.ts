import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";

const LESSONS_DIR = path.resolve(process.cwd(), "..", "learning-plan", "lessons");

export type LessonFrontmatter = {
  day: number;
  slug: string;
  title: string;
  week: number;
  week_theme: string;
  anchor_benchmark: string;
  harness: string;
  reading_time_minutes: number;
};

export type Lesson = {
  frontmatter: LessonFrontmatter;
  html: string;
};

export type LessonSummary = Pick<
  LessonFrontmatter,
  "day" | "slug" | "title" | "week" | "week_theme" | "anchor_benchmark" | "reading_time_minutes"
>;

async function listLessonFiles(): Promise<string[]> {
  const entries = await fs.readdir(LESSONS_DIR);
  return entries.filter((name) => /^d\d{2}-.+\.md$/.test(name)).sort();
}

export async function getAllLessonDays(): Promise<number[]> {
  const files = await listLessonFiles();
  return files.map((f) => Number.parseInt(f.slice(1, 3), 10));
}

export async function getAllLessonSummaries(): Promise<LessonSummary[]> {
  const files = await listLessonFiles();
  const summaries: LessonSummary[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
    const { data } = matter(raw);
    const fm = data as LessonFrontmatter;
    summaries.push({
      day: fm.day,
      slug: fm.slug,
      title: fm.title,
      week: fm.week,
      week_theme: fm.week_theme,
      anchor_benchmark: fm.anchor_benchmark,
      reading_time_minutes: fm.reading_time_minutes,
    });
  }
  return summaries;
}

export async function getLessonByDay(day: number): Promise<Lesson | null> {
  const files = await listLessonFiles();
  const dayPrefix = `d${String(day).padStart(2, "0")}-`;
  const file = files.find((f) => f.startsWith(dayPrefix));
  if (!file) return null;
  const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
  const { data, content } = matter(raw);
  const html = await markdownToHtml(content);
  return { frontmatter: data as LessonFrontmatter, html };
}
