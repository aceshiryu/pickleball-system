import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { BookingSlot } from './booking-slot.entity';
import { Court } from '../courts/court.entity';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';
import { slotRate } from './pricing';
import { mapBooking, BookingView } from './booking.serializer';
import {
  AdminCreateBookingDto,
  ContactDto,
  SlotItemDto,
} from './dto/booking-dtos';

// Statuses that occupy a slot (block it on the calendar).
const OCCUPYING: BookingStatus[] = [
  'hold',
  'pending_approval',
  'confirmed',
  'checked_in',
];

// How an occupied slot is presented to the customer calendar: a 'hold' is a
// temporary 10-minute block that may reopen, 'booked' is everything firmer.
export type SlotState = 'hold' | 'booked';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Raw queries bypass TypeORM's hydration, so the pg driver hands back a `date`
// column as a Date pinned to LOCAL midnight, while entity loads give a plain
// 'YYYY-MM-DD' string. Normalize both to the calendar date the web app keys its
// slots by. Must use local parts: toISOString() would shift the day backwards
// (2026-07-22 00:00 +08:00 -> "2026-07-21T16:00:00Z").
function toISODate(v: string | Date): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, '0');
  const d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function genRef(i: number): string {
  return `PKL-${Date.now().toString(36).toUpperCase()}${i}`;
}

// Secret, unguessable ownership token for a guest booking session. The browser
// that booked keeps it; every guest-only endpoint requires it.
function genGuestToken(): string {
  return `g_${randomBytes(24).toString('base64url')}`;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
  ) {}

  // Cancel holds whose 10-minute window has elapsed: the slot reopens (cancelled
  // is not an occupying status) and the booking stays in the customer's history
  // as "cancelled" instead of silently disappearing.
  private async releaseExpiredHolds(): Promise<void> {
    await this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({
        status: 'cancelled',
        note: 'your 10-minute hold expired.',
        holdExpiresAt: null,
      })
      .where('status = :held', { held: 'hold' })
      .andWhere('hold_expires_at < :now', { now: new Date() })
      .execute();
  }

  // Which of the requested slots are already occupied by someone else — a live
  // hold (within its 10-minute window), a booking pending approval, a confirmed
  // booking, or one currently checked in. Callers must run releaseExpiredHolds()
  // first so lapsed holds don't count.
  private async findConflicts(items: SlotItemDto[]): Promise<SlotItemDto[]> {
    if (items.length === 0) return [];
    const courtIds = [...new Set(items.map((i) => i.courtId))];
    const dates = [...new Set(items.map((i) => i.date))];
    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.slots', 's')
      .select('b.court_id', 'courtId')
      .addSelect('s.date', 'date')
      .addSelect('s.hour', 'hour')
      .where('b.status IN (:...st)', { st: OCCUPYING })
      .andWhere('b.court_id IN (:...courtIds)', { courtIds })
      .andWhere('s.date IN (:...dates)', { dates })
      .getRawMany<{ courtId: string; date: string | Date; hour: number }>();
    const taken = new Set(
      rows.map((r) => `${r.courtId}|${toISODate(r.date)}|${Number(r.hour)}`),
    );
    return items.filter((i) => taken.has(`${i.courtId}|${i.date}|${i.hour}`));
  }

  // The calendar only renders open hours, but a crafted request could ask for
  // one outside them — reject rather than trust the client.
  private async assertWithinOpeningHours(items: SlotItemDto[]): Promise<void> {
    const { openHour, closeHour } = await this.settingsService.getOpeningHours();
    const bad = items.find((i) => i.hour < openHour || i.hour >= closeHour);
    if (bad) {
      throw new BadRequestException(
        `${bad.hour}:00 is outside opening hours (${openHour}:00-${closeHour}:00).`,
      );
    }
  }

  // Guard a reservation against slots that were taken (held or pending) since
  // the customer's calendar last loaded. Rejects the whole request so nothing
  // is double-booked.
  private async assertSlotsFree(items: SlotItemDto[]): Promise<void> {
    const conflicts = await this.findConflicts(items);
    if (conflicts.length > 0) {
      throw new ConflictException({
        message:
          'Some of those slots were just taken by someone else. Please pick another time.',
        conflicts,
      });
    }
  }

  private async reload(ids: string[]): Promise<BookingView[]> {
    if (ids.length === 0) return [];
    const rows = await this.bookingRepo.find({
      where: { id: In(ids) },
      order: { createdAt: 'DESC' },
    });
    return rows.map(mapBooking);
  }

  async findAllForAdmin(): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    const rows = await this.bookingRepo.find({ order: { createdAt: 'DESC' } });
    return rows.map(mapBooking);
  }

  async findMine(customerId: string): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    const rows = await this.bookingRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(mapBooking);
  }

  // Occupied slots (upcoming) for the customer calendar — no personal data.
  // `state` distinguishes a temporary 10-minute hold from a firm booking so the
  // calendar can show it as held rather than fully booked. Either way the slot
  // is unbookable by anyone else.
  async availability(): Promise<
    { courtId: string; date: string; hour: number; state: SlotState }[]
  > {
    await this.releaseExpiredHolds();
    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.slots', 's')
      .select('b.court_id', 'courtId')
      .addSelect('s.date', 'date')
      .addSelect('s.hour', 'hour')
      .addSelect('b.status', 'status')
      .where('b.status IN (:...st)', { st: OCCUPYING })
      .andWhere('s.date >= :today', { today: todayISO() })
      .getRawMany<{
        courtId: string;
        date: string | Date;
        hour: number;
        status: BookingStatus;
      }>();
    return rows.map((r) => ({
      courtId: r.courtId,
      date: toISODate(r.date),
      hour: Number(r.hour),
      state: r.status === 'hold' ? 'hold' : 'booked',
    }));
  }

  private groupByCourt(items: SlotItemDto[]): Map<string, SlotItemDto[]> {
    const byCourt = new Map<string, SlotItemDto[]>();
    for (const it of items) {
      const arr = byCourt.get(it.courtId) ?? [];
      arr.push(it);
      byCourt.set(it.courtId, arr);
    }
    return byCourt;
  }

  // Contact for a booking: an explicit override, else the signed-in customer's
  // own profile (the online "auto-fill").
  private async contactFor(
    customerId: string | null,
    override?: ContactDto,
  ): Promise<{ name: string; phone: string; email: string | null }> {
    if (override) {
      return {
        name: override.name.trim(),
        phone: override.phone.trim(),
        email: override.email?.trim() || null,
      };
    }
    const user = customerId ? await this.usersService.findById(customerId) : null;
    return {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      email: user?.email ?? null,
    };
  }

  private async buildBookings(
    customerId: string | null,
    items: SlotItemDto[],
    opts: {
      status: BookingStatus;
      proofFileName: string | null;
      proofImage?: string | null;
      holdExpiresAt: Date | null;
      contact: { name: string; phone: string; email: string | null };
      paymentMethod?: string | null;
      paymentReference?: string | null;
      seenByAdmin?: boolean;
      guestToken?: string | null;
    },
  ): Promise<string[]> {
    const byCourt = this.groupByCourt(items);
    const createdIds: string[] = [];
    // Read the peak schedule once: every slot in this request prices against
    // the same snapshot, and each rate is then frozen onto its row.
    const schedule = await this.settingsService.getPeakSchedule();
    let i = 0;
    for (const [courtId, slots] of byCourt) {
      const court = await this.courtRepo.findOne({ where: { id: courtId } });
      if (!court) throw new NotFoundException(`Court ${courtId} not found`);
      i++;
      const priced = slots.map((s) => {
        const slot = new BookingSlot();
        slot.date = s.date;
        slot.hour = s.hour;
        slot.rate = slotRate(court, s.date, s.hour, schedule);
        return slot;
      });
      const entity = this.bookingRepo.create({
        ref: genRef(i),
        customerId,
        courtId,
        hours: slots.length,
        total: priced.reduce((sum, s) => sum + s.rate, 0),
        proofFileName: opts.proofFileName,
        proofImage: opts.proofImage ?? null,
        status: opts.status,
        holdExpiresAt: opts.holdExpiresAt,
        contactName: opts.contact.name,
        contactPhone: opts.contact.phone,
        contactEmail: opts.contact.email,
        paymentMethod: opts.paymentMethod ?? null,
        paymentReference: opts.paymentReference ?? null,
        seenByAdmin: opts.seenByAdmin ?? false,
        guestToken: opts.guestToken ?? null,
        slots: priced,
      });
      const saved = await this.bookingRepo.save(entity);
      createdIds.push(saved.id);
    }
    return createdIds;
  }

  // Reserve slots for 10 minutes (status "hold"), one booking per court.
  async hold(
    customerId: string,
    items: SlotItemDto[],
    contact?: ContactDto,
  ): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    await this.assertWithinOpeningHours(items);
    await this.assertSlotsFree(items);
    const holdExpiresAt = new Date(Date.now() + 10 * 60_000);
    const ids = await this.buildBookings(customerId, items, {
      status: 'hold',
      proofFileName: null,
      holdExpiresAt,
      contact: await this.contactFor(customerId, contact),
    });
    return this.reload(ids);
  }

  // --- Guest booking (no account) ---------------------------------------
  // Same flow as hold(), but customerId is null and ownership is proved by a
  // secret guestToken instead of the JWT. The token is returned to the browser,
  // which stores it and presents it to pay/release/view/claim.

  async holdGuest(
    items: SlotItemDto[],
    contact: ContactDto,
  ): Promise<{ bookings: BookingView[]; guestToken: string }> {
    await this.releaseExpiredHolds();
    await this.assertWithinOpeningHours(items);
    await this.assertSlotsFree(items);
    const holdExpiresAt = new Date(Date.now() + 10 * 60_000);
    const guestToken = genGuestToken();
    const ids = await this.buildBookings(null, items, {
      status: 'hold',
      proofFileName: null,
      holdExpiresAt,
      contact: await this.contactFor(null, contact),
      guestToken,
    });
    return { bookings: await this.reload(ids), guestToken };
  }

  async submitPaymentGuest(
    guestToken: string,
    ids: string[],
    proofFileName: string,
    proofImage?: string,
  ): Promise<BookingView[]> {
    await this.assertOwnsAll(ids, guestToken);
    const stored = proofImage !== undefined ? await this.storeProof(proofImage) : null;
    await this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({
        status: 'pending_approval',
        proofFileName,
        ...(stored ?? {}),
        holdExpiresAt: null,
        seenByAdmin: false,
      })
      .where('id IN (:...ids)', { ids })
      .andWhere('guest_token = :guestToken', { guestToken })
      .execute();
    return this.reload(ids);
  }

  async releaseHoldsGuest(guestToken: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.bookingRepo.softDelete({
      id: In(ids),
      guestToken,
      status: 'hold',
    });
  }

  // The guest's own bookings, by the tokens their browser is holding.
  async findByGuestTokens(tokens: string[]): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    if (tokens.length === 0) return [];
    const rows = await this.bookingRepo.find({
      where: { guestToken: In(tokens) },
      order: { createdAt: 'DESC' },
    });
    return rows.map(mapBooking);
  }

  // Attach guest bookings to a now-signed-in account: set customer_id and clear
  // the token so it can't be replayed. Only rows whose token the caller supplied
  // are touched — possession of the token is the authorisation.
  async claim(customerId: string, tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    const res = await this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({ customerId, guestToken: null })
      .where('guest_token IN (:...tokens)', { tokens })
      .execute();
    return res.affected ?? 0;
  }

  // Guard: every id must exist and carry this guest token, or 403.
  private async assertOwnsAll(ids: string[], guestToken: string): Promise<void> {
    const count = await this.bookingRepo.count({
      where: { id: In(ids), guestToken },
    });
    if (count !== ids.length) {
      throw new ForbiddenException('Not your booking');
    }
  }

  // Front-desk booking. The money is taken at the counter, so this skips
  // hold -> pending_approval -> approve and lands straight on confirmed,
  // blocking the slot immediately. `customerId` is optional: a walk-in may have
  // no account, in which case only the contact details identify them.
  async adminCreate(dto: AdminCreateBookingDto): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    await this.assertWithinOpeningHours(dto.items);
    await this.assertSlotsFree(dto.items);

    let customerId: string | null = null;
    if (dto.customerId) {
      const user = await this.usersService.findById(dto.customerId);
      if (!user) throw new NotFoundException('Customer not found');
      customerId = user.id;
    }

    const isCash =
      dto.paymentMethod.trim().toLowerCase() === 'cash';
    const ids = await this.buildBookings(customerId, dto.items, {
      status: 'confirmed',
      proofFileName: null,
      holdExpiresAt: null,
      contact: await this.contactFor(customerId, dto.contact),
      paymentMethod: dto.paymentMethod.trim(),
      paymentReference: isCash ? null : (dto.referenceNumber?.trim() ?? null),
      seenByAdmin: true,
    });
    return this.reload(ids);
  }

  // Direct booking submission (skips the hold step).
  async createBookings(
    customerId: string,
    items: SlotItemDto[],
    proofFileName: string,
    proofImage?: string,
  ): Promise<BookingView[]> {
    await this.releaseExpiredHolds();
    await this.assertWithinOpeningHours(items);
    await this.assertSlotsFree(items);
    const ids = await this.buildBookings(customerId, items, {
      status: 'pending_approval',
      proofFileName,
      proofImage: proofImage ?? null,
      holdExpiresAt: null,
      contact: await this.contactFor(customerId),
    });
    return this.reload(ids);
  }

  // Attach payment proof to holds -> pending approval.
  async submitPayment(
    customerId: string,
    ids: string[],
    proofFileName: string,
    proofImage?: string,
  ): Promise<BookingView[]> {
    const stored = proofImage !== undefined ? await this.storeProof(proofImage) : null;
    await this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({
        status: 'pending_approval',
        proofFileName,
        // Only overwrite the stored receipt when a new one is supplied.
        ...(stored ?? {}),
        holdExpiresAt: null,
        seenByAdmin: false,
      })
      .where('id IN (:...ids)', { ids })
      .andWhere('customer_id = :customerId', { customerId })
      .execute();
    return this.reload(ids);
  }

  // Store an uploaded receipt. Prefers Supabase; falls back to the inline
  // column when storage isn't configured so local dev still works.
  private async storeProof(
    dataUrl: string,
  ): Promise<{ proofPath: string | null; proofImage: string | null }> {
    const path = await this.storage.uploadDataUrl(
      this.storage.receiptsBucket,
      'proofs',
      dataUrl,
    );
    return path ? { proofPath: path, proofImage: null } : { proofPath: null, proofImage: dataUrl };
  }

  // Called when a review concludes. Deletes the object and clears both columns
  // — proofFileName is kept so the booking still shows a receipt was recorded.
  private async purgeProof(booking: Booking): Promise<void> {
    if (booking.proofPath) {
      await this.storage.remove(this.storage.receiptsBucket, booking.proofPath);
    }
    booking.proofPath = null;
    booking.proofImage = null;
  }

  // The receipt image itself, fetched on demand (it's kept out of list payloads).
  // Visible to any admin/staff, or to the customer who owns the booking.
  async proofFor(
    id: string,
    requester: { sub: string; role: string },
  ): Promise<{
    fileName: string | null;
    image: string | null;
    recorded: boolean;
    removed: boolean;
  }> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isStaff = requester.role === 'admin' || requester.role === 'staff';
    if (!isStaff && booking.customerId !== requester.sub) {
      throw new ForbiddenException('Not your booking');
    }

    const recorded = !!booking.proofFileName;
    // A short-lived signed URL for the private object; older rows may still
    // carry an inline data URL.
    let image: string | null = null;
    if (booking.proofPath) {
      image = await this.storage.signedUrl(
        this.storage.receiptsBucket,
        booking.proofPath,
      );
    } else if (booking.proofImage) {
      image = booking.proofImage;
    }

    return {
      fileName: booking.proofFileName,
      image,
      recorded,
      // Receipt was submitted, but the image is gone — purged once the admin
      // approved or rejected. This is expected, not an error.
      removed: recorded && !image,
    };
  }

  // Deliberate abandon (the customer went Back to change their selection).
  // Soft delete so the slot reopens — reads filter out soft-deleted rows — while
  // the record survives.
  async releaseHolds(customerId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.bookingRepo.softDelete({
      id: In(ids),
      customerId,
      status: 'hold',
    });
  }

  private async setStatus(
    id: string,
    status: BookingStatus,
    note?: string,
    clearProof = false,
  ): Promise<BookingView> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    booking.status = status;
    if (note !== undefined) booking.note = note;
    if (clearProof) await this.purgeProof(booking);
    await this.bookingRepo.save(booking);
    return mapBooking((await this.bookingRepo.findOne({ where: { id } }))!);
  }

  // Confirming records how the payment was verified, not just the status.
  async approve(
    id: string,
    paymentMethod: string,
    referenceNumber: string,
  ): Promise<BookingView> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    booking.status = 'confirmed';
    booking.paymentMethod = paymentMethod.trim();
    booking.paymentReference = referenceNumber.trim();
    // The receipt has served its purpose — the method + reference are now the
    // audit record. Delete the object from Supabase and clear the row.
    // proofFileName stays, so the booking still shows a receipt was recorded.
    await this.purgeProof(booking);
    await this.bookingRepo.save(booking);
    return mapBooking((await this.bookingRepo.findOne({ where: { id } }))!);
  }
  reject(id: string, reason: string) {
    // The review is over — drop the receipt image like approval does.
    return this.setStatus(id, 'rejected', reason, true);
  }
  cancel(id: string, reason: string) {
    return this.setStatus(id, 'cancelled', reason);
  }
  complete(id: string) {
    return this.setStatus(id, 'completed');
  }
  noShow(id: string) {
    return this.setStatus(id, 'no_show');
  }

  // Check in a booking; any booking already checked in on the same court is
  // completed (the court turns over to the next player).
  async checkIn(id: string): Promise<BookingView> {
    const target = await this.bookingRepo.findOne({ where: { id } });
    if (!target) throw new NotFoundException('Booking not found');
    await this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({ status: 'completed' })
      .where('court_id = :courtId', { courtId: target.courtId })
      .andWhere("status = 'checked_in'")
      .execute();
    return this.setStatus(id, 'checked_in');
  }

  async acknowledge(id: string): Promise<BookingView> {
    await this.bookingRepo.update(id, { seenByAdmin: true });
    return mapBooking((await this.bookingRepo.findOne({ where: { id } }))!);
  }
}
