import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate: unauthenticated visitors to app routes go to sign-in.
 * This only checks for the cookie; every page and action re-validates the
 * session and permissions on the server.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("form_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/clinic/:path*"],
};
