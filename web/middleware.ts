import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

/**
 * Auth middleware. Runs only when APP_PASSCODE env var is set —
 * otherwise it short-circuits and the app is open (useful for local
 * dev where typing a passcode every refresh is friction).
 *
 * When enabled:
 *   - Unauthenticated users hitting an app route are redirected to
 *     /login?from=<original-path> (they bounce back after login).
 *   - Unauthenticated users hitting an API route get 401 JSON.
 *   - Authenticated users hitting /login are redirected to /.
 *   - The service worker (/sw.js), the manifest, and the icon are
 *     always public so the PWA can install pre-login.
 */
export async function middleware(request: NextRequest) {
  if (!process.env.APP_PASSCODE) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // iron-session in middleware uses the (req, res, options) form. The
  // response is mutated only if we call session.save() — we just read,
  // so the throwaway `passthroughRes` is safe to use as the let-them-
  // through return value too.
  const passthroughRes = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    passthroughRes,
    sessionOptions,
  );
  const authed = session.authenticated === true;

  if (pathname === "/login") {
    if (authed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return passthroughRes;
  }

  if (authed) return passthroughRes;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on app + api routes, but skip Next.js internals, the SW,
  // manifest, icon, and the auth API itself.
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|icon.svg|manifest.webmanifest|sw.js|api/auth).*)",
  ],
};
