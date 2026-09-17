import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "brak_session";

// Szybkie przekierowanie na podstawie obecności ciasteczka sesji — tylko
// wygoda UX. Faktyczna weryfikacja sesji (ważność, DB lookup) dzieje się
// zawsze w `src/app/app/layout.tsx`, zgodnie z zaleceniem Next.js 16, żeby
// nie polegać wyłącznie na Proxy przy autoryzacji.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/zaloguj", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
