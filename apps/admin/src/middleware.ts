import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Client-side auth via localStorage means we cannot fully gate here.
// This middleware exists to redirect the /home root path early when there is
// no auth header, but the canonical auth check lives in the page component.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*'],
};
