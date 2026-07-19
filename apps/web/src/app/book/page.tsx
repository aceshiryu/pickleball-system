'use client';

import React from 'react';
import { useStore } from '@shared/lib/store';
import { ProfileSetup } from '@shared/components/Auth';
import TermsGate from '@/components/Terms';
import CustomerApp from '@/components/customer/CustomerApp';

// The booking surface — open to guests. A signed-in customer still passes
// through the profile + terms gates first; a guest goes straight to the
// calendar (the checkout collects contact details and terms as it goes).
export default function BookPage() {
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
  if (loggedIn && role === 'customer') {
    if (needsProfile) return <ProfileSetup />;
    if (!termsAccepted)
      return <TermsGate onAccept={acceptTerms} onCancel={logout} />;
  }
  return <CustomerApp />;
}
