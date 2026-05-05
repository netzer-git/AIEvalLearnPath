"use client";
import { useEffect } from "react";

export default function MermaidInit() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "var(--font-sans)",
      });
      await mermaid.run({
        querySelector: "pre.mermaid",
        suppressErrors: false,
      });
    })().catch((err) => {
      console.error("mermaid render failed", err);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
