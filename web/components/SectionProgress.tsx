"use client";
import { useEffect, useState } from "react";

/**
 * Live "M / N sections done" counter for the lesson page. Sits above
 * the Complete button. Reads section state directly from the DOM
 * (each .section-check button carries data-completed) and updates in
 * response to the `section-toggle` CustomEvent dispatched by
 * SectionTracker.
 */
export default function SectionProgress() {
  const [state, setState] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  useEffect(() => {
    const recompute = () => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        ".lesson-content button.section-check",
      );
      const total = buttons.length;
      let done = 0;
      buttons.forEach((b) => {
        if (b.dataset.completed === "true") done += 1;
      });
      setState({ done, total });
    };

    // Initial compute. SectionTracker may not have applied initial
    // state yet (it fetches /api/progress async on mount), so listen
    // for its toggle events too — and also recompute after a short
    // delay to catch the post-fetch hydration.
    recompute();
    const delayedId = window.setTimeout(recompute, 250);
    const handler = () => recompute();
    document.addEventListener("section-toggle", handler);
    return () => {
      window.clearTimeout(delayedId);
      document.removeEventListener("section-toggle", handler);
    };
  }, []);

  if (state.total === 0) return null;
  const allDone = state.done === state.total;
  const className = allDone
    ? "section-progress section-progress--full"
    : "section-progress";
  return (
    <div className={className} aria-live="polite">
      {state.done} / {state.total} sections done
      {allDone ? " — ready to mark complete" : ""}
    </div>
  );
}
