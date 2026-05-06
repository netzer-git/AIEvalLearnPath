import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev resources (HMR, RSC streams, client component
  // chunks) to be requested from these origins. Without this, opening
  // the app on a phone via the LAN IP (e.g. http://10.26.8.184:3000)
  // causes the dev server to block the HMR connection, which cascades
  // to break client-component hydration — the rendered SSR markup
  // is fine but onClick handlers never attach. Only matters in dev;
  // production builds aren't affected.
  allowedDevOrigins: [
    "10.26.8.184",
    // If the LAN IP changes, add it here. Wildcard isn't supported.
  ],
};

export default nextConfig;
