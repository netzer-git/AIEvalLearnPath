"use client";
import { useEffect } from "react";

/**
 * Registers the service worker that lives at /sw.js.
 *
 * Production-only. In dev (`next dev`), Next.js serves chunks with
 * compile-version query strings that defeat naive caching, and HMR
 * uses /_next/webpack-hmr which we explicitly skip in the SW; running
 * the SW alongside HMR adds noise without buying offline capability
 * during development. To exercise offline mode locally, run:
 *
 *     cd web && npm run build && npm start
 *
 * then turn off Wi-Fi and reload a page you've already visited.
 *
 * Mounted once from app/layout.tsx so it covers every route.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        // Periodically check for SW updates (when the user keeps the
        // page open across deploys). Cheap; bails on unchanged SW.
        const id = window.setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
        return () => window.clearInterval(id);
      } catch (err) {
        // Non-fatal — the app works fine without the SW.
        console.warn("[sw] registration failed", err);
      }
    };
    register();
  }, []);

  return null;
}
