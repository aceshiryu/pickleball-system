import './globals.css';
import type { Metadata } from 'next';
import { StoreProvider } from '@shared/lib/store';
import { Toasts } from '@shared/components/ui';
import { ConfirmProvider } from '@shared/components/Confirm';
import BrandingStyle from '@shared/components/BrandingStyle';

export const metadata: Metadata = {
  title: 'AfterHours, Book pickleball courts online',
  description:
    'Reserve courts, pay online, and manage your facility, the easiest way to play more pickleball.',
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
