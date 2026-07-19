/**
 * A facility's accepted payment method, stored as a JSONB array on settings.
 * `type` drives which detail fields apply:
 *   gcash / maya : `phone` required, `qr` optional
 *   bank         : `bankName` + `accountNumber` + `accountName` required, `qr` optional
 *   cash / other : `label` only
 * `qr` is an inline data: URL (same convention as the brand logo).
 */
export type PaymentMethodType = 'gcash' | 'maya' | 'bank' | 'cash' | 'other';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  phone?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  qr?: string | null;
}
