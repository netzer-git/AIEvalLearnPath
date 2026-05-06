"use client";
import { useEffect } from "react";

/**
 * SectionTracker
 * --------------
 * The lesson body is rendered server-side via dangerouslySetInnerHTML,
 * with each <h2> wrapped in a <details data-section-slug="..."> element
 * by `rehypeWrapSections` (see web/lib/markdown.ts). Each section's
 * <summary> contains a `<button class="section-check">` placeholder.
 *
 * This component runs once on mount, fetches the user's section progress
 * from /api/progress, hydrates each placeholder button with its current
 * completion state, and wires up click handlers that POST to the
 * per-section progress route. We don't reach for full React rendering
 * of the lesson body here because the markdown pipeline produces HTML
 * that's most easily SSR'd as a single innerHTML blob — imperative
 * decoration is the simplest path to interactive completion toggles.
 */
export default function SectionTracker({ day }: { day: number }) {
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    async function init() {
      let completed: Record<string, string> = {};
      try {
        const res = await fetch("/api/progress");
        if (res.ok) {
          const data = await res.json();
          completed = data?.sections?.[String(day)] ?? {};
        }
      } catch {
        // network down — proceed with empty completion
      }
      if (cancelled) return;

      const buttons = document.querySelectorAll<HTMLButtonElement>(
        ".lesson-content button.section-check",
      );
      buttons.forEach((btn) => {
        const slug = btn.dataset.sectionSlug;
        if (!slug) return;
        const section = btn.closest<HTMLDetailsElement>(
          "details.lesson-section",
        );
        if (!section) return;

        const initiallyComplete = !!completed[slug];
        if (initiallyComplete) {
          section.classList.add("lesson-section--done");
          btn.dataset.completed = "true";
        }

        const onClick = async (e: MouseEvent) => {
          // Don't toggle the surrounding <details> when the button is
          // clicked; the user is marking complete, not collapsing.
          e.preventDefault();
          e.stopPropagation();

          const wasComplete = btn.dataset.completed === "true";
          const newState = !wasComplete;

          // Optimistic UI
          btn.dataset.completed = String(newState);
          section.classList.toggle("lesson-section--done", newState);
          // Notify SectionProgress (and any other listeners) so the
          // "M / N sections" counter updates instantly.
          document.dispatchEvent(
            new CustomEvent("section-toggle", {
              detail: { slug, completed: newState },
            }),
          );

          try {
            const res = await fetch(
              `/api/progress/lesson/${day}/section/${encodeURIComponent(slug)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: newState }),
              },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          } catch {
            // Revert optimistic change
            btn.dataset.completed = String(wasComplete);
            section.classList.toggle("lesson-section--done", wasComplete);
            document.dispatchEvent(
              new CustomEvent("section-toggle", {
                detail: { slug, completed: wasComplete },
              }),
            );
          }
        };

        btn.addEventListener("click", onClick);
        cleanups.push(() => btn.removeEventListener("click", onClick));
      });
    }

    init();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [day]);

  return null;
}
