import { Booking } from './booking.entity';

// Flattens a Booking entity (+ relations) into the shape the web app's store
// expects: customer/court names inlined, slots as {date,hour}, ISO dates.
export interface BookingView {
  id: string;
  ref: string;
  // null when a walk-in has no account.
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  contactPhone: string;
  courtId: string;
  courtName: string;
  // `rate` is the price charged for that hour, frozen when the booking was made.
  slots: { date: string; hour: number; rate: number }[];
  hours: number;
  total: number;
  proofFileName: string;
  // An image is available to view right now (fetched separately).
  hasProof: boolean;
  // A receipt WAS submitted at some point — stays true after the image is
  // purged on approve/reject, so the UI can say "recorded, image removed".
  proofRecorded: boolean;
  status: Booking['status'];
  createdAt: string;
  note?: string;
  // How the admin verified payment when confirming.
  paymentMethod?: string;
  paymentReference?: string;
  holdExpiresAt?: string;
  seenByAdmin: boolean;
}

export function mapBooking(b: Booking): BookingView {
  const slots = (b.slots ?? [])
    .map((s) => ({ date: s.date, hour: s.hour, rate: s.rate ?? 0 }))
    .sort((a, z) =>
      a.date === z.date ? a.hour - z.hour : a.date < z.date ? -1 : 1,
    );

  return {
    id: b.id,
    ref: b.ref,
    customerId: b.customerId ?? null,
    // Contact details win: they're what was captured for THIS booking. Fall
    // back to the linked account for rows created before contact existed.
    customerName: b.contactName || b.customer?.name || '',
    customerEmail: b.contactEmail ?? b.customer?.email ?? '',
    contactPhone: b.contactPhone || b.customer?.phone || '',
    courtId: b.courtId,
    courtName: b.court?.name ?? '',
    slots,
    hours: b.hours,
    total: b.total,
    proofFileName: b.proofFileName ?? '',
    hasProof: !!(b.proofPath || b.proofImage),
    proofRecorded: !!b.proofFileName,
    status: b.status,
    createdAt:
      b.createdAt instanceof Date
        ? b.createdAt.toISOString()
        : String(b.createdAt),
    note: b.note ?? undefined,
    paymentMethod: b.paymentMethod ?? undefined,
    paymentReference: b.paymentReference ?? undefined,
    holdExpiresAt: b.holdExpiresAt
      ? b.holdExpiresAt instanceof Date
        ? b.holdExpiresAt.toISOString()
        : String(b.holdExpiresAt)
      : undefined,
    seenByAdmin: b.seenByAdmin,
  };
}
