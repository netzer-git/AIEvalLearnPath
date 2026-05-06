import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  authenticated?: boolean;
};

/**
 * Session config for iron-session. Two env vars drive the behavior:
 *
 *   SESSION_PASSWORD  — secret for cookie encryption (must be ≥32 chars).
 *   APP_PASSCODE      — the passcode the user types at /login.
 *
 * If APP_PASSCODE is unset, auth is disabled (open access). Useful for
 * local dev. Set both in production / when exposing via Cloudflare
 * Tunnel.
 */
export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_PASSWORD ??
    // 32-char default so iron-session doesn't throw when running
    // without env vars (auth is disabled in that mode anyway). Replace
    // for real deployments via .env.local.
    "dev-only-do-not-use-in-prod-aaaaaaaa",
  cookieName: "aielearn_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 14 days
    maxAge: 60 * 60 * 24 * 14,
  },
};

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSCODE);
}
