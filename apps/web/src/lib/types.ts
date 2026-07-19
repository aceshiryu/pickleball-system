export type Role = "customer" | "admin";

export type AccessLevel = "admin" | "staff";

export interface Staff {
  id: string;
  name: string;
  email: string;
  access: AccessLevel;
}

export type CourtStatus = "active" | "maintenance";

export interface Court {
  id: string;
  name: string;
  surface: string;
  peakRate: number;
  offPeakRate: number;
  status: CourtStatus;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedAt: string; // ISO date
  spend?: number; // lifetime spend, provided by the API customers endpoint
}

export type BookingStatus =
  | "hold"
  | "pending_approval"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "rejected"
  | "cancelled";

export interface Slot {
  date: string; // yyyy-mm-dd
  hour: number; // 6..21 (start hour)
  // Price charged for this hour, frozen when the booking was made. Always show
  // this for an existing booking rather than recomputing from current rates.
  rate: number;
}

export type OverrideScope = "date" | "hours" | "week";
export type OverrideReason = "maintenance" | "holiday" | "private_event" | "other";

export interface Override {
  id: string;
  label: string;
  reason: OverrideReason;
  courtId: string; // "all" or a specific court id
  scope: OverrideScope;
  date: string; // yyyy-mm-dd, the day (date/hours) or any day within the week (week)
  startHour?: number; // hours scope: inclusive
  endHour?: number; // hours scope: exclusive
}

export interface Booking {
  id: string;
  ref: string;
  // null for a walk-in with no account.
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  contactPhone: string;
  courtId: string;
  courtName: string;
  slots: Slot[];
  hours: number;
  total: number;
  proofFileName: string;
  hasProof?: boolean; // an image is viewable right now (fetched separately)
  proofRecorded?: boolean; // a receipt was submitted (stays true after purge)
  status: BookingStatus;
  createdAt: string; // ISO datetime
  note?: string; // rejection / cancellation reason
  // Recorded by the admin when confirming the booking.
  paymentMethod?: string;
  paymentReference?: string;
  holdExpiresAt?: string; // ISO datetime, while status === "hold"
  seenByAdmin?: boolean; // admin has opened/acknowledged the booking
}
