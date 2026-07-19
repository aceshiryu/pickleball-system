import './globals.css';
import type { Metadata } from 'next';
import { StoreProvider } from '@shared/lib/store';
import { Toasts } from '@shared/components/ui';
import { ConfirmProvider } from '@shared/components/Confirm';
import BrandingStyle from '@shared/components/BrandingStyle';

export const metadata: Metadata = {
  title: 'AfterHours Admin',
  description: 'Facility console — courts, bookings, approvals, and settings.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <BrandingStyle />
          <ConfirmProvider>
            {children}
            <Toasts />
          </ConfirmProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
