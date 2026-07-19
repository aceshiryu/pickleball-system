'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AccessLevel,
  Booking,
  Court,
  Customer,
  Override,
  Role,
  Staff,
} from './types';
import { findOverride } from './overrides';
import { DEFAULT_FONT_KEY } from './fonts';
import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  DEFAULT_PEAK_SCHEDULE,
  hourList,
  isPeak,
  slotRate,
  type PeakSchedule,
} from './pricing';
import { api, getToken, setToken } from './api-client';
import { requestGoogleIdToken } from './google';

export interface Toast {
  id: number;
  title: string;
  body: string;
  kind: 'success' | 'info' | 'error';
}

export interface SelItem {
  courtId: string;
  date: string;
  hour: number;
}

// Who to contact about a booking. Auto-filled from the signed-in customer
// online; typed by the front desk for a walk-in.
export interface BookingContact {
  name: string;
  phone: string;
  email?: string;
}

// A booking taken at the counter. customerId is optional — a walk-in may have
// no account, in which case the contact details are all we hold.
export interface AdminBookingInput {
  items: SelItem[];
  customerId?: string;
  contact: BookingContact;
  paymentMethod: string;
  referenceNumber?: string;
}

// Why a calendar slot is occupied: a temporary 10-minute hold, or a firm booking.
export type SlotState = 'hold' | 'booked';

// A newly created staff account. `tempPassword` is returned by the API only at
// creation time (it is stored hashed), so it must be surfaced/copied right away.
export interface CreatedStaff extends Staff {
  tempPassword: string;
}

export const HOLD_MINUTES = 10;

export interface Branding {
  appName: string;
  primary: string;
  secondary: string;
  // Square logo as a data: URL. null/empty falls back to the built-in mark.
  logoUrl: string | null;
  // Key of the chosen font pairing (see lib/fonts.ts).
  fontFamily: string;
  // Facility-wide peak hours (one-hour intervals), configured in Court management.
  peakHoursWeekday: number[];
  peakHoursWeekend: number[];
  // Opening hours. closeHour is exclusive, so 0-24 means open all day.
  openHour: number;
  closeHour: number;
  // Payment methods this facility accepts, shown to customers at checkout.
  paymentMethods: string[];
  // False until the admin finishes first-run setup; the console is locked and
  // most write APIs are refused until then.
  onboardingComplete: boolean;
}
export const DEFAULT_BRANDING: Branding = {
  appName: 'AfterHours',
  primary: '#6B2B2B',
  secondary: '#6E7275',
  logoUrl: null,
  fontFamily: DEFAULT_FONT_KEY,
  peakHoursWeekday: DEFAULT_PEAK_SCHEDULE.weekday,
  peakHoursWeekend: DEFAULT_PEAK_SCHEDULE.weekend,
  openHour: DEFAULT_OPEN_HOUR,
  closeHour: DEFAULT_CLOSE_HOUR,
  paymentMethods: ['Cash'],
  // Assume complete until settings load, so the modal can't flash on a
  // configured facility.
  onboardingComplete: true,
};

interface PublicUser {
  id: string;
  email: string;
  role: 'customer' | 'staff' | 'admin';
  name: string;
  phone: string | null;
}

interface StoreValue {
  restoring: boolean;
  role: Role;

  loggedIn: boolean;
  logout: () => void;
  currentCustomer: Customer;

  // customer onboarding (simulated Google)
  needsProfile: boolean;
  googleLogin: () => Promise<void>;
  completeProfile: (name: string, phone: string) => Promise<void>;

  termsAccepted: boolean;
  acceptTerms: () => void;

  // branding / white-label
  branding: Branding;
  updateBranding: (patch: Partial<Branding>) => void;

  // Facility peak-hour schedule + live pricing for slots that aren't booked yet.
  peakSchedule: PeakSchedule;
  isPeakAt: (date: string, hour: number) => boolean;
  rateAt: (court: Court, date: string, hour: number) => number;
  // Bookable start hours from the facility's opening hours.
  bookableHours: number[];

  // admin session + staff directory
  access: AccessLevel;
  adminName: string;
  adminLogin: (email: string, password: string) => Promise<void>;
  staff: Staff[];
  addStaff: (s: Omit<Staff, 'id'>) => Promise<CreatedStaff>;
  resetStaffPassword: (id: string) => Promise<CreatedStaff>;
  removeStaff: (id: string) => void;
  setStaffAccess: (id: string, access: AccessLevel) => void;
  signInAs: (id: string) => void;

  // payment methods (facility config, stored on settings)
  paymentMethods: string[];
  addPaymentMethod: (label: string) => void;
  removePaymentMethod: (label: string) => void;
  completeOnboarding: () => Promise<void>;
  onboardingComplete: boolean;

  courts: Court[];
  customers: Customer[];
  bookings: Booking[];
  overrides: Override[];

  checkInBooking: (id: string) => void;
  completeBooking: (id: string) => void;
  markNoShow: (id: string) => void;

  toasts: Toast[];
  dismissToast: (id: number) => void;

  isSlotBooked: (courtId: string, date: string, hour: number) => boolean;
  isSlotHeld: (courtId: string, date: string, hour: number) => boolean;
  getOverride: (
    courtId: string,
    date: string,
    hour: number,
  ) => Override | undefined;

  // customer booking actions
  holdBookings: (
    items: SelItem[],
    contact?: BookingContact,
  ) => Promise<Booking[]>;
  adminCreateBooking: (input: AdminBookingInput) => Promise<Booking[]>;
  submitPayment: (
    ids: string[],
    proofFileName: string,
    proofImage?: string,
  ) => Promise<void>;
  releaseHolds: (ids: string[]) => Promise<void>;
  // re-fetch bookings + availability (e.g. when a hold's countdown reaches zero)
  refreshHolds: () => void;

  // admin actions
  acknowledgeBooking: (id: string) => void;
  approveBooking: (
    id: string,
    paymentMethod: string,
    referenceNumber: string,
  ) => void;
  rejectBooking: (id: string, reason: string) => void;
  cancelBooking: (id: string, reason: string) => void;

  addOverride: (o: Omit<Override, 'id'>) => void;
  removeOverride: (id: string) => void;

  addCourt: (c: Omit<Court, 'id'>) => void;
  updateCourt: (c: Court) => void;
  toggleMaintenance: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let toastSeq = 1;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <StoreInner>{children}</StoreInner>
    </QueryClientProvider>
  );
}

function StoreInner({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // --- session ---
  const [user, setUser] = useState<PublicUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [viewAs, setViewAs] = useState<{
    access: AccessLevel;
    name: string;
  } | null>(null);

  // Restore a session from a stored token on first mount.
  useEffect(() => {
    const t = getToken();
    if (!t) {
      setRestoring(false);
      return;
    }
    api
      .get<PublicUser>('/auth/me')
      .then((u) => {
        setUser(u);
        setNeedsProfile(u.role === 'customer' && !u.phone);
        if (u.role !== 'customer') setTermsAccepted(true);
      })
      .catch(() => setToken(null))
      .finally(() => setRestoring(false));
  }, []);

  const loggedIn = !!user;
  const role: Role = user?.role === 'customer' ? 'customer' : 'admin';
  const isAdminSide =
    loggedIn && (user!.role === 'admin' || user!.role === 'staff');
  const isCustomer = loggedIn && user!.role === 'customer';
  const realAccess: AccessLevel = user?.role === 'staff' ? 'staff' : 'admin';
  const access: AccessLevel = viewAs?.access ?? realAccess;
  const adminName = viewAs?.name ?? user?.name ?? 'Admin';

  const currentCustomer: Customer = {
    id: user?.id ?? 'me',
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    joinedAt: '',
  };

  // --- toasts ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  function pushToast(t: Omit<Toast, 'id'>) {
    const id = toastSeq++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      6000,
    );
  }
  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  // --- queries ---
  const authed = !restoring && loggedIn;

  const brandingQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Branding>('/settings'),
  });
  const courtsQ = useQuery({
    queryKey: ['courts'],
    queryFn: () => api.get<Court[]>('/courts'),
    enabled: authed,
  });
  const overridesQ = useQuery({
    queryKey: ['overrides'],
    queryFn: () => api.get<Override[]>('/overrides'),
    enabled: authed,
  });
  const availabilityQ = useQuery({
    queryKey: ['availability'],
    queryFn: () =>
      api.get<
        { courtId: string; date: string; hour: number; state?: SlotState }[]
      >('/bookings/availability'),
    enabled: authed,
    // Poll so slots held by others appear as taken, and lapsed 10-minute holds
    // reopen, without the customer refreshing the page.
    refetchInterval: 15_000,
  });
  const bookingsQ = useQuery({
    queryKey: ['bookings', role],
    queryFn: () =>
      isAdminSide
        ? api.get<Booking[]>('/bookings')
        : api.get<Booking[]>('/bookings/mine'),
    enabled: authed,
    // Poll so the list and each booking's status stay current on their own —
    // new holds appear, expired holds flip to cancelled, and admin approvals /
    // rejections show up without a manual refresh.
    refetchInterval: 15_000,
  });
  const customersQ = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: authed && isAdminSide,
  });
  const staffQ = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<Staff[]>('/staff'),
    enabled: authed && isAdminSide,
  });

  const branding = brandingQ.data ?? DEFAULT_BRANDING;
  const courts = courtsQ.data ?? [];
  const overrides = overridesQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const customers = customersQ.data ?? [];
  const staff = staffQ.data ?? [];

  // key -> why the slot is occupied ('hold' = someone's live 10-minute hold).
  const occupied = useMemo(() => {
    const m = new Map<string, SlotState>();
    for (const s of availabilityQ.data ?? []) {
      m.set(`${s.courtId}|${s.date}|${s.hour}`, s.state ?? 'booked');
    }
    return m;
  }, [availabilityQ.data]);

  // Live peak schedule from settings. Only ever applies to slots that aren't
  // booked yet — booked/held slots carry their own frozen `rate`.
  const peakSchedule = useMemo<PeakSchedule>(
    () => ({
      weekday: branding.peakHoursWeekday ?? DEFAULT_PEAK_SCHEDULE.weekday,
      weekend: branding.peakHoursWeekend ?? DEFAULT_PEAK_SCHEDULE.weekend,
    }),
    [branding.peakHoursWeekday, branding.peakHoursWeekend],
  );
  const bookableHours = useMemo(
    () =>
      hourList(
        branding.openHour ?? DEFAULT_OPEN_HOUR,
        branding.closeHour ?? DEFAULT_CLOSE_HOUR,
      ),
    [branding.openHour, branding.closeHour],
  );
  const isPeakAt = (date: string, hour: number) =>
    isPeak(date, hour, peakSchedule);
  const rateAt = (court: Court, date: string, hour: number) =>
    slotRate(court, date, hour, peakSchedule);

  function isSlotBooked(courtId: string, date: string, hour: number): boolean {
    return occupied.has(`${courtId}|${date}|${hour}`);
  }
  // Occupied by a live hold — blocked for others, but may reopen in <10 min.
  function isSlotHeld(courtId: string, date: string, hour: number): boolean {
    return occupied.get(`${courtId}|${date}|${hour}`) === 'hold';
  }
  function getOverride(courtId: string, date: string, hour: number) {
    return findOverride(overrides, courtId, date, hour);
  }

  const invalidate = (keys: string[]) =>
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const refreshBookings = () =>
    invalidate(['bookings', 'availability', 'customers']);

  // --- auth actions ---
  async function googleLogin() {
    // The ID token is minted by Google in the browser and verified server-side;
    // the client never asserts who it is.
    const idToken = await requestGoogleIdToken();
    const r = await api.post<{
      accessToken: string;
      user: PublicUser;
      needsProfile: boolean;
    }>('/auth/google', { idToken });
    setToken(r.accessToken);
    setUser(r.user);
    setNeedsProfile(r.needsProfile);
    setTermsAccepted(false);
    setViewAs(null);
    queryClient.invalidateQueries();
  }
  async function completeProfile(name: string, phone: string) {
    const u = await api.post<PublicUser>('/auth/complete-profile', {
      name,
      phone,
    });
    setUser(u);
    setNeedsProfile(false);
  }
  async function adminLogin(email: string, password: string) {
    const r = await api.post<{ accessToken: string; user: PublicUser }>(
      '/auth/login',
      { email, password },
    );
    setToken(r.accessToken);
    setUser(r.user);
    setTermsAccepted(true);
    setViewAs(null);
    queryClient.invalidateQueries();
  }
  function logout() {
    setToken(null);
    setUser(null);
    setNeedsProfile(false);
    setTermsAccepted(false);
    setViewAs(null);
    queryClient.clear();
  }
  function acceptTerms() {
    setTermsAccepted(true);
  }

  // --- customer booking actions ---
  async function holdBookings(
    items: SelItem[],
    contact?: BookingContact,
  ): Promise<Booking[]> {
    const clean = items.map((i) => ({
      courtId: i.courtId,
      date: i.date,
      hour: i.hour,
    }));
    try {
      const created = await api.post<Booking[]>('/bookings/hold', {
        items: clean,
        contact,
      });
      refreshBookings();
      return created;
    } catch (e) {
      // A rejected hold usually means someone else just took a slot — refresh
      // availability so the calendar reflects that right away.
      invalidate(['availability']);
      throw e;
    }
  }
  async function submitPayment(
    ids: string[],
    proofFileName: string,
    proofImage?: string,
  ) {
    await api.post('/bookings/submit-payment', { ids, proofFileName, proofImage });
    pushToast({
      kind: 'info',
      title: ids.length > 1 ? `${ids.length} bookings submitted` : 'Payment submitted',
      body: 'Awaiting admin approval of your payment.',
    });
    refreshBookings();
  }
  async function releaseHolds(ids: string[]) {
    if (ids.length === 0) return;
    await api.post('/bookings/release-holds', { ids });
    refreshBookings();
  }
  // Re-fetch /bookings/mine + availability. The bookings fetch makes the API
  // sweep expired holds (cancelling them and reopening their slots), so an
  // elapsed countdown flips the card to "cancelled" and frees the calendar.
  function refreshHolds() {
    invalidate(['bookings', 'availability']);
  }

  // Front desk booking: created already confirmed, blocking the slot at once.
  async function adminCreateBooking(
    input: AdminBookingInput,
  ): Promise<Booking[]> {
    const created = await api.post<Booking[]>('/bookings/admin-create', {
      items: input.items.map((i) => ({
        courtId: i.courtId,
        date: i.date,
        hour: i.hour,
      })),
      customerId: input.customerId,
      contact: input.contact,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
    });
    refreshBookings();
    pushToast({
      kind: 'success',
      title: 'Booking confirmed',
      body: `${input.contact.name}'s court time is blocked off.`,
    });
    return created;
  }

  // --- admin booking actions ---
  const bookingAction = async (
    id: string,
    action: string,
    body?: unknown,
    toast?: Omit<Toast, 'id'>,
  ) => {
    await api.post(`/bookings/${id}/${action}`, body);
    if (toast) pushToast(toast);
    refreshBookings();
  };
  const acknowledgeBooking = (id: string) => {
    void bookingAction(id, 'acknowledge');
  };
  const approveBooking = (
    id: string,
    paymentMethod: string,
    referenceNumber: string,
  ) => {
    void bookingAction(id, 'approve', { paymentMethod, referenceNumber }, {
      kind: 'success',
      title: 'Booking confirmed',
      body: `Payment recorded via ${paymentMethod}. Confirmation email sent.`,
    });
  };
  const rejectBooking = (id: string, reason: string) => {
    void bookingAction(id, 'reject', { reason }, {
      kind: 'error',
      title: 'Booking rejected',
      body: 'Customer notified by email. Slots reopened.',
    });
  };
  const cancelBooking = (id: string, reason: string) => {
    void bookingAction(id, 'cancel', { reason }, {
      kind: 'info',
      title: 'Booking cancelled',
      body: 'Slots reopened for booking. Customer notified.',
    });
  };
  const checkInBooking = (id: string) => {
    void bookingAction(id, 'check-in', undefined, {
      kind: 'success',
      title: 'Checked in',
      body: 'Court is now in use.',
    });
  };
  const completeBooking = (id: string) => {
    void bookingAction(id, 'complete', undefined, {
      kind: 'info',
      title: 'Booking completed',
      body: 'Court is now available.',
    });
  };
  const markNoShow = (id: string) => {
    void bookingAction(id, 'no-show', undefined, {
      kind: 'info',
      title: 'Marked as no-show',
      body: 'The court time was released.',
    });
  };

  // --- courts ---
  function addCourt(c: Omit<Court, 'id'>) {
    void (async () => {
      try {
        await api.post('/courts', {
          name: c.name,
          surface: c.surface,
          peakRate: c.peakRate,
          offPeakRate: c.offPeakRate,
        });
        invalidate(['courts']);
        pushToast({ kind: 'success', title: 'Court added', body: c.name });
      } catch (e) {
        pushToast({
          kind: 'error',
          title: 'Could not add court',
          body: e instanceof Error ? e.message : 'Please try again.',
        });
      }
    })();
  }
  function updateCourt(c: Court) {
    void (async () => {
      try {
        await api.patch(`/courts/${c.id}`, {
          name: c.name,
          surface: c.surface,
          peakRate: c.peakRate,
          offPeakRate: c.offPeakRate,
          status: c.status,
        });
        invalidate(['courts']);
        pushToast({ kind: 'success', title: 'Court updated', body: c.name });
      } catch (e) {
        // Without this the rejection was swallowed and the dialog just closed,
        // looking as though the edit had saved.
        pushToast({
          kind: 'error',
          title: 'Could not update court',
          body: e instanceof Error ? e.message : 'Please try again.',
        });
      }
    })();
  }
  function toggleMaintenance(id: string) {
    void (async () => {
      try {
        await api.post(`/courts/${id}/toggle-maintenance`);
        invalidate(['courts', 'availability']);
      } catch (e) {
        pushToast({
          kind: 'error',
          title: 'Could not change maintenance',
          body: e instanceof Error ? e.message : 'Please try again.',
        });
      }
    })();
  }

  // --- overrides ---
  function addOverride(o: Omit<Override, 'id'>) {
    void (async () => {
      await api.post('/overrides', o);
      invalidate(['overrides', 'availability']);
      pushToast({ kind: 'success', title: 'Block added', body: o.label });
    })();
  }
  function removeOverride(id: string) {
    void (async () => {
      await api.del(`/overrides/${id}`);
      invalidate(['overrides', 'availability']);
      pushToast({ kind: 'info', title: 'Block removed', body: 'Slots reopened.' });
    })();
  }

  // --- payment methods ---
  // Stored as a whole array on settings, so add/remove are just list edits.
  // Case-insensitive dedupe: 'GCash' and 'gcash' are the same method to a
  // customer reading a dropdown.
  function addPaymentMethod(label: string) {
    const next = label.trim();
    if (!next) return;
    const existing = branding.paymentMethods;
    if (existing.some((m) => m.toLowerCase() === next.toLowerCase())) {
      pushToast({
        kind: 'info',
        title: 'Already added',
        body: `${next} is already an accepted method.`,
      });
      return;
    }
    updateBranding({ paymentMethods: [...existing, next] });
    pushToast({ kind: 'success', title: 'Payment method added', body: next });
  }

  function removePaymentMethod(label: string) {
    updateBranding({
      paymentMethods: branding.paymentMethods.filter((m) => m !== label),
    });
  }

  // Marks first-run setup finished. The API re-validates the prerequisites.
  async function completeOnboarding() {
    await api.post('/settings/complete-onboarding');
    invalidate(['settings']);
  }
  // --- branding ---
  // Also carries the peak-hour schedule. Changing it reprices every slot that
  // isn't booked yet; existing bookings keep their frozen rates.
  function updateBranding(patch: Partial<Branding>) {
    void (async () => {
      try {
        await api.patch('/settings', patch);
        invalidate(['settings']);
      } catch (e) {
        pushToast({
          kind: 'error',
          title: 'Could not save settings',
          body: e instanceof Error ? e.message : 'Please try again.',
        });
      }
    })();
  }

  // --- staff ---
  async function addStaff(s: Omit<Staff, 'id'>): Promise<CreatedStaff> {
    const created = await api.post<CreatedStaff>('/staff', {
      name: s.name,
      email: s.email,
      access: s.access,
    });
    invalidate(['staff']);
    pushToast({ kind: 'success', title: 'Staff added', body: `${s.name} (${s.access})` });
    return created;
  }
  async function resetStaffPassword(id: string): Promise<CreatedStaff> {
    const updated = await api.post<CreatedStaff>(`/staff/${id}/reset-password`);
    pushToast({
      kind: 'success',
      title: 'Password reset',
      body: `${updated.name}'s previous password no longer works.`,
    });
    return updated;
  }
  function removeStaff(id: string) {
    void (async () => {
      await api.del(`/staff/${id}`);
      invalidate(['staff']);
      pushToast({ kind: 'info', title: 'Staff removed', body: 'Account revoked.' });
    })();
  }
  function setStaffAccess(id: string, a: AccessLevel) {
    void (async () => {
      await api.patch(`/staff/${id}`, { access: a });
      invalidate(['staff']);
    })();
  }
  function signInAs(id: string) {
    const s = staff.find((x) => x.id === id);
    if (!s) return;
    setViewAs({ access: s.access, name: s.name });
    pushToast({
      kind: 'info',
      title: `Viewing as ${s.name}`,
      body: s.access === 'admin' ? 'Full admin access' : 'Limited staff access',
    });
  }

  const value = useMemo<StoreValue>(
    () => ({
      restoring,
      role,
      loggedIn,
      logout,
      currentCustomer,
      needsProfile,
      googleLogin,
      completeProfile,
      termsAccepted,
      acceptTerms,
      branding,
      updateBranding,
      peakSchedule,
      isPeakAt,
      rateAt,
      bookableHours,
      access,
      adminName,
      adminLogin,
      staff,
      addStaff,
      resetStaffPassword,
      removeStaff,
      setStaffAccess,
      signInAs,
      paymentMethods: branding.paymentMethods,
      addPaymentMethod,
      removePaymentMethod,
      completeOnboarding,
      onboardingComplete: branding.onboardingComplete,
      courts,
      customers,
      bookings,
      overrides,
      checkInBooking,
      completeBooking,
      markNoShow,
      toasts,
      dismissToast,
      isSlotBooked,
      isSlotHeld,
      getOverride,
      holdBookings,
      adminCreateBooking,
      submitPayment,
      releaseHolds,
      refreshHolds,
      acknowledgeBooking,
      approveBooking,
      rejectBooking,
      cancelBooking,
      addOverride,
      removeOverride,
      addCourt,
      updateCourt,
      toggleMaintenance,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restoring,
      user,
      needsProfile,
      termsAccepted,
      viewAs,
      branding,
      courts,
      overrides,
      bookings,
      customers,
      staff,
      toasts,
      occupied,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
