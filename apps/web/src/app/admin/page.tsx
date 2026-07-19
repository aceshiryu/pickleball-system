'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import AdminApp from '@/components/admin/AdminApp';

export default function AdminPage() {
  const { loggedIn, role, restoring } = useStore();
  const router = useRouter();
  const ok = loggedIn && role === 'admin';
  useEffect(() => {
    if (!restoring && !ok) router.replace('/admin/login');
  }, [ok, restoring, router]);
  if (restoring || !ok) return null;
  return <AdminApp />;
}
