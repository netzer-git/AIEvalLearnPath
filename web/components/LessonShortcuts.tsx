"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard shortcuts on lesson pages, per the locked spec in AGENTS.md:
 *   j → next lesson
 *   k → previous lesson
 *   m → click the .complete-button (Mark complete)
 *
 * Ignored when the user is typing in an input or contenteditable, or
 * when modifier keys (ctrl/alt/meta) are held.
 */
export default function LessonShortcuts({ day }: { day: number }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        )
          return;
      }
      if (e.key === "j") {
        if (day < 28) {
          e.preventDefault();
          router.push(`/lesson/${day + 1}`);
        }
      } else if (e.key === "k") {
        if (day > 1) {
          e.preventDefault();
          router.push(`/lesson/${day - 1}`);
        }
      } else if (e.key === "m") {
        const btn = document.querySelector<HTMLButtonElement>(
          ".lesson-complete .complete-button",
        );
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, router]);
  return null;
}
