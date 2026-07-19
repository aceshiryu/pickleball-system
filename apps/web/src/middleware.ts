import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Hostname routing for the demo deployment.
 *
 * The customer app and the admin console are one Next.js deployable — the
 * console is a route inside it (`/admin`), not a separate service. App Engine
 * dispatch can only route a hostname to a *service*, not rewrite a path, so
 * the split between the two hostnames happens here:
 *
 *   demo-admin.bookly-ph.com/      → serves /admin
 *   demo-admin.bookly-ph.com/*     → admin routes only; anything else 404s
 *   demo-customer.bookly-ph.com/*  → customer app; /admin is NOT served
 *
 * Without the second rule the console would be reachable on the customer
 * hostname too, which makes the separate hostname decorative.
 *
 * Both hosts are configurable so this does nothing on localhost, on the
 * *.appspot.com URLs, or in the e2e suites — an unrecognised host falls
 * straight through and the app behaves exactly as it does today.
 */
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST ?? '';
const CUSTOMER_HOST = process.env.NEXT_PUBLIC_CUSTOMER_HOST ?? '';

export function middleware(req: NextRequest) {
  // Strip the port: App Engine passes the bare hostname, but a local
  // reverse-proxy test would carry :3000.
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const { pathname } = req.nextUrl;

  if (ADMIN_HOST && host === ADMIN_HOST) {
    // Bare hostname lands on the console rather than the public landing page.
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    // Keep the customer surface off the admin hostname. /login is allowed:
    // /admin/login lives under /admin, but a staff member who lands on the
    // customer sign-in page from a stale link should still see something.
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
      return new NextResponse('Not found', { status: 404 });
    }
    return NextResponse.next();
  }

  if (CUSTOMER_HOST && host === CUSTOMER_HOST && pathname.startsWith('/admin')) {
    // The console is not served here. Send staff to the hostname that does,
    // if we know it; otherwise just refuse.
    if (ADMIN_HOST) {
      const url = req.nextUrl.clone();
      url.host = ADMIN_HOST;
      url.port = '';
      return NextResponse.redirect(url);
    }
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets — those must be served
  // on both hostnames or the pages render unstyled.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
