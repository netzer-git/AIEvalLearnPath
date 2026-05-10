"use client";
import { useEffect } from "react";

/**
 * SectionTracker
 * --------------
 * The lesson body is rendered server-side via dangerouslySetInnerHTML,
 * with each <h2> wrapped in a <details data-section-slug="..."> element
 * by `rehypeWrapSections` (see web/lib/markdown.ts). Each section's
 * <summary> contains a `<button class="section-check">` placeholder
 * that doubles as a completion badge, and each section's tail contains
 * a `<button class="section-mark-read">` for the primary "I finished
 * reading this section, collapse it" action.
 *
 * This component runs once on mount, fetches the user's section progress
 * from /api/progress, hydrates each placeholder button with its current
 * completion state, default-collapses already-completed sections, and
 * wires up click handlers that POST to the per-section progress route.
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

      const sections = document.querySelectorAll<HTMLDetailsElement>(
        ".lesson-content details.lesson-section",
      );

      // Helper: drive the visual + persistence side-effect of toggling
      // a section's completion. Optimistic UI; revert on POST failure.
      const setSectionState = (
        section: HTMLDetailsElement,
        slug: string,
        complete: boolean,
        collapseOnComplete: boolean,
      ): Promise<void> => {
        const checkBtn = section.querySelector<HTMLButtonElement>(
          "button.section-check",
        );
        const markBtn = section.querySelector<HTMLButtonElement>(
          "button.section-mark-read",
        );
        const wasComplete = section.classList.contains("lesson-section--done");
        section.classList.toggle("lesson-section--done", complete);
        if (checkBtn) checkBtn.dataset.completed = String(complete);
        if (markBtn) markBtn.dataset.completed = String(complete);
        if (complete && collapseOnComplete) section.open = false;
        if (!complete) section.open = true;

        document.dispatchEvent(
          new CustomEvent("section-toggle", {
            detail: { slug, completed: complete },
          }),
        );

        return fetch(
          `/api/progress/lesson/${day}/section/${encodeURIComponent(slug)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: complete }),
          },
        )
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          })
          .catch(() => {
            // Revert optimistic change
            section.classList.toggle("lesson-section--done", wasComplete);
            if (checkBtn) checkBtn.dataset.completed = String(wasComplete);
            if (markBtn) markBtn.dataset.completed = String(wasComplete);
            section.open = !wasComplete ? true : section.open;
            document.dispatchEvent(
              new CustomEvent("section-toggle", {
                detail: { slug, completed: wasComplete },
              }),
            );
          });
      };

      sections.forEach((section) => {
        const slug = section.dataset.sectionSlug;
        if (!slug) return;
        const checkBtn = section.querySelector<HTMLButtonElement>(
          "button.section-check",
        );
        const markBtn = section.querySelector<HTMLButtonElement>(
          "button.section-mark-read",
        );

        // Initial hydration: completed sections get the done class +
        // default-collapsed. Markdown emits `open` on the <details> at
        // build time, so we override here once we know completion state.
        const initiallyComplete = !!completed[slug];
        if (initiallyComplete) {
          section.classList.add("lesson-section--done");
          section.open = false;
          if (checkBtn) checkBtn.dataset.completed = "true";
          if (markBtn) markBtn.dataset.completed = "true";
        }

        // Summary check button: badge + un-mark toggle. Clicking it does
        // NOT collapse the surrounding <details> (the surrounding click
        // would otherwise fire the native toggle); we stop propagation
        // and explicitly run our state setter without the
        // collapse-on-complete behavior so the user can mark from the
        // summary without losing their place.
        if (checkBtn) {
          const onCheckClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const wasComplete = checkBtn.dataset.completed === "true";
            void setSectionState(section, slug, !wasComplete, false);
          };
          checkBtn.addEventListener("click", onCheckClick);
          cleanups.push(() =>
            checkBtn.removeEventListener("click", onCheckClick),
          );
        }

        // Bottom mark-read button: forward-flow action — mark complete
        // AND collapse the section so the next one is visible.
        if (markBtn) {
          const onMarkClick = (e: MouseEvent) => {
            e.preventDefault();
            const wasComplete = markBtn.dataset.completed === "true";
            void setSectionState(section, slug, !wasComplete, !wasComplete);
          };
          markBtn.addEventListener("click", onMarkClick);
          cleanups.push(() =>
            markBtn.removeEventListener("click", onMarkClick),
          );
        }
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
