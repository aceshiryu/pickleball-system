'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@shared/lib/store';
import AdminApp from '@/components/admin/AdminApp';

// The console root. This whole app is the admin surface (served at the admin
// hostname), so the gate lives here and sends unauthenticated visitors to
// /login rather than the old in-web /admin/login.
export default function AdminPage() {
  const { loggedIn, role, restoring } = useStore();
  const router = useRouter();
  const ok = loggedIn && role === 'admin';
  useEffect(() => {
    if (!restoring && !ok) router.replace('/login');
  }, [ok, restoring, router]);
  if (restoring || !ok) return null;
  return <AdminApp />;
}
