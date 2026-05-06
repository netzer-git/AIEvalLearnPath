import type { MetadataRoute } from "next";

/**
 * Web app manifest. Next.js serves this at `/manifest.webmanifest`
 * automatically when this file lives in the app/ root.
 *
 * Drives "Add to Home Screen" / "Install" behavior on mobile and
 * desktop browsers. `display: standalone` makes the app open without
 * the browser chrome once installed; `theme_color` sets the status
 * bar / titlebar color to match the dark theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIEvalLearnPath",
    short_name: "AIEvalPath",
    description:
      "A 28-lesson self-paced curriculum on LLM evaluation — ~30 min/day.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
