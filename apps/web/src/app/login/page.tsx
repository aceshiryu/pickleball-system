'use client';

import React from 'react';
import { useStore } from '@shared/lib/store';
import { CustomerLogin, ProfileSetup } from '@shared/components/Auth';
import TermsGate from '@/components/Terms';
import CustomerApp from '@/components/customer/CustomerApp';

export default function LoginPage() {
  const {
    loggedIn,
    role,
    needsProfile,
    termsAccepted,
    acceptTerms,
    logout,
    restoring,
  } = useStore();
  if (restoring) return null;
  if (!(loggedIn && role === 'customer')) return <CustomerLogin />;
  if (needsProfile) return <ProfileSetup />;
  if (!termsAccepted)
    return <TermsGate onAccept={acceptTerms} onCancel={logout} />;
  return <CustomerApp />;
}
