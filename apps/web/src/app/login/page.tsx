'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@shared/lib/store';
import { CustomerLogin } from '@shared/components/Auth';

// Explicit customer sign-in. Booking doesn't require it (guests book at /book);
// this is for saving/seeing your bookings. Once signed in, hand off to /book,
// which runs the profile/terms gates and shows the app.
export default function LoginPage() {
  const { loggedIn, role, restoring } = useStore();
  const router = useRouter();
  const signedIn = loggedIn && role === 'customer';
  useEffect(() => {
    if (!restoring && signedIn) router.replace('/book');
  }, [restoring, signedIn, router]);
  if (restoring || signedIn) return null;
  return <CustomerLogin />;
}
