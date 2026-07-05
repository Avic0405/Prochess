import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard', '/game', '/lobby', '/profile', '/admin',
  '/payment', '/friends', '/wallet', '/history', '/leaderboard', '/settings',
];

// Exact paths that are guest-only
const GUEST_ONLY_EXACT = ['/'];

// Prefix-matched paths that are guest-only
const GUEST_ONLY_PREFIXES = [
  '/login', '/register', '/forgot-password', '/reset-password',
  '/verify-email', '/oauth-success', '/verify-otp',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Treat the user as authenticated if either token cookie is present.
  // The accessToken expires in 15 min, but a valid refreshToken lets the
  // axios interceptor obtain a new one on the first API call — so checking
  // only accessToken would incorrectly log users out between refreshes.
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const isAuthenticated = !!(accessToken || refreshToken);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isGuestOnly =
    GUEST_ONLY_EXACT.includes(pathname) ||
    GUEST_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnly && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
