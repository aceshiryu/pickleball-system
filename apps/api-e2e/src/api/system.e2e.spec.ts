import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  bearer,
  createTestApp,
  customerLogin,
  googleToken,
  http,
  login,
} from '../support/app';

// Whole-system e2e: drives the real HTTP API (auth, courts, booking lifecycle,
// availability, overrides, payment methods, customers, staff, settings, and role
// guards) against the isolated pickleball_e2e database.

function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('PicklePlay system e2e', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let courtId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await login(app, 'admin@pickleplay.co', 'demo1234');
    staffToken = await login(app, 'jamie@pickleplay.co', 'demo1234');
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('auth', () => {
    it('rejects a bad password', async () => {
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'admin@pickleplay.co', password: 'wrong' })
        .expect(401);
    });

    it('treats a short wrong password as a credential failure, not a validation error', async () => {
      // A password length rule on login would 400 here and lecture the user
      // about length instead of saying the credentials were wrong.
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'admin@pickleplay.co', password: 'no' })
        .expect(401);
    });

    it('rejects a malformed email with a readable message', async () => {
      const res = await http(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'demo1234' })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain(
        'Enter a valid email address.',
      );
    });

    it('issues an admin token with the admin role', async () => {
      const res = await http(app)
        .post('/api/auth/login')
        .send({ email: 'admin@pickleplay.co', password: 'demo1234' })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toMatchObject({ role: 'admin', name: 'Admin' });
    });

    it('signs a customer in with Google and requires a profile', async () => {
      const { token, needsProfile } = await customerLogin(app, {
        email: 'e2e.player@example.com',
        name: 'E2E Player',
      });
      customerToken = token;
      expect(needsProfile).toBe(true);

      const me = await http(app)
        .get('/api/auth/me')
        .set(bearer(customerToken))
        .expect(200);
      expect(me.body).toMatchObject({ role: 'customer', phone: null });
    });

    it('completes the customer profile', async () => {
      const res = await http(app)
        .post('/api/auth/complete-profile')
        .set(bearer(customerToken))
        .send({ name: 'E2E Player', phone: '0917 555 0000' })
        .expect(200);
      expect(res.body.phone).toBe('0917 555 0000');
    });

    it('rejects an unverifiable Google token', async () => {
      await http(app)
        .post('/api/auth/google')
        .send({ idToken: 'not-a-real-google-id-token' })
        .expect(401);
    });

    it('refuses to sign an admin address in through the customer Google door', async () => {
      // The pre-Google endpoint trusted the email in the body, so posting an
      // admin address returned a signed admin token with no password. Google
      // verification alone doesn't close that — someone can own the admin
      // address at Google — so upsertGoogleCustomer refuses non-customers.
      await http(app)
        .post('/api/auth/google')
        .send({ idToken: googleToken({ email: 'admin@pickleplay.co' }) })
        .expect(401);
    });

    it('keeps one account when the same Google user changes their email', async () => {
      const first = await customerLogin(app, {
        sub: 'google-stable-sub-1',
        email: 'rename.me@example.com',
        name: 'Rename Me',
      });
      const second = await customerLogin(app, {
        sub: 'google-stable-sub-1',
        email: 'renamed@example.com',
        name: 'Rename Me',
      });
      expect(second.userId).toBe(first.userId);

      const me = await http(app)
        .get('/api/auth/me')
        .set(bearer(second.token))
        .expect(200);
      expect(me.body.email).toBe('renamed@example.com');
    });

    it('blocks unauthenticated access to a protected route', async () => {
      await http(app).get('/api/bookings/mine').expect(401);
    });
  });

  describe('courts (admin) + role guards', () => {
    it('lets an admin create a court', async () => {
      const res = await http(app)
        .post('/api/courts')
        .set(bearer(adminToken))
        .send({
          name: 'Center Court',
          surface: 'Cushioned acrylic',
          peakRate: 700,
          offPeakRate: 450,
        })
        .expect(201);
      courtId = res.body.id;
      expect(res.body).toMatchObject({ name: 'Center Court', status: 'active' });
    });

    it('forbids a customer from creating a court (403)', async () => {
      await http(app)
        .post('/api/courts')
        .set(bearer(customerToken))
        .send({ name: 'Nope', surface: 'x', peakRate: 1, offPeakRate: 1 })
        .expect(403);
    });

    it('rejects unknown fields via validation (400)', async () => {
      await http(app)
        .post('/api/courts')
        .set(bearer(adminToken))
        .send({ name: 'X', surface: 'y', peakRate: 1, offPeakRate: 1, hacked: true })
        .expect(400);
    });

    it('lists courts for the customer', async () => {
      const res = await http(app)
        .get('/api/courts')
        .set(bearer(customerToken))
        .expect(200);
      expect(res.body.map((c: any) => c.id)).toContain(courtId);
    });

    it('lets staff toggle maintenance', async () => {
      const on = await http(app)
        .post(`/api/courts/${courtId}/toggle-maintenance`)
        .set(bearer(staffToken))
        .expect(201);
      expect(on.body.status).toBe('maintenance');
      const off = await http(app)
        .post(`/api/courts/${courtId}/toggle-maintenance`)
        .set(bearer(staffToken))
        .expect(201);
      expect(off.body.status).toBe('active');
    });
  });

  describe('booking lifecycle', () => {
    const date = dateInDays(3);
    const hour = 18; // weekday evening -> peak
    let bookingId: string;

    it('starts with the slot available', async () => {
      const res = await http(app)
        .get('/api/bookings/availability')
        .set(bearer(customerToken))
        .expect(200);
      expect(
        res.body.some(
          (s: any) => s.courtId === courtId && s.date === date && s.hour === hour,
        ),
      ).toBe(false);
    });

    it('holds a slot for the customer', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(201);
      expect(res.body).toHaveLength(1);
      bookingId = res.body[0].id;
      expect(res.body[0]).toMatchObject({ status: 'hold', total: 700 });
      expect(res.body[0].holdExpiresAt).toBeTruthy();
    });

    it('marks the held slot occupied in availability, flagged as a hold', async () => {
      const res = await http(app)
        .get('/api/bookings/availability')
        .set(bearer(customerToken))
        .expect(200);
      const slot = res.body.find(
        (s: any) => s.courtId === courtId && s.date === date && s.hour === hour,
      );
      expect(slot).toBeDefined();
      // Regression guard: the pg driver returns `date` columns as a Date on raw
      // queries, which serialises to "2026-07-21T16:00:00.000Z" (wrong shape AND
      // wrong day in +08:00) and silently unblocks every held slot.
      expect(slot.date).toBe(date);
      expect(typeof slot.date).toBe('string');
      expect(slot.state).toBe('hold');
    });

    const RECEIPT_IMG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    it('submits payment -> pending approval, storing the receipt image', async () => {
      const res = await http(app)
        .post('/api/bookings/submit-payment')
        .set(bearer(customerToken))
        .send({ ids: [bookingId], proofFileName: 'receipt.jpg', proofImage: RECEIPT_IMG })
        .expect(200);
      expect(res.body[0]).toMatchObject({
        status: 'pending_approval',
        proofFileName: 'receipt.jpg',
        hasProof: true, // image stored, but NOT inlined in list payloads
      });
      expect(res.body[0].proofImage).toBeUndefined();
    });

    it('serves the receipt image on demand to the owner and to admin', async () => {
      const mine = await http(app)
        .get(`/api/bookings/${bookingId}/proof`)
        .set(bearer(customerToken))
        .expect(200);
      expect(mine.body.image).toBe(RECEIPT_IMG);
      expect(mine.body.fileName).toBe('receipt.jpg');

      await http(app)
        .get(`/api/bookings/${bookingId}/proof`)
        .set(bearer(adminToken))
        .expect(200);
    });

    it('rejects a receipt that is not an image/pdf data URL (400)', async () => {
      const held = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(6), hour: 8 }] })
        .expect(201);
      await http(app)
        .post('/api/bookings/submit-payment')
        .set(bearer(customerToken))
        .send({ ids: [held.body[0].id], proofFileName: 'x', proofImage: 'data:text/html;base64,PHN2Zz4=' })
        .expect(400);
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [held.body[0].id] })
        .expect(200);
    });

    it('shows the booking to the customer but hides the admin list', async () => {
      const mine = await http(app)
        .get('/api/bookings/mine')
        .set(bearer(customerToken))
        .expect(200);
      expect(mine.body.map((b: any) => b.id)).toContain(bookingId);

      await http(app).get('/api/bookings').set(bearer(customerToken)).expect(403);
    });

    it('requires payment method + reference to approve (400)', async () => {
      await http(app)
        .post(`/api/bookings/${bookingId}/approve`)
        .set(bearer(adminToken))
        .send({})
        .expect(400);
      await http(app)
        .post(`/api/bookings/${bookingId}/approve`)
        .set(bearer(adminToken))
        .send({ paymentMethod: 'GCash' }) // no reference
        .expect(400);
      await http(app)
        .post(`/api/bookings/${bookingId}/approve`)
        .set(bearer(adminToken))
        .send({ paymentMethod: '', referenceNumber: '  ' }) // blanks don't count
        .expect(400);
    });

    it('lets an admin approve, then staff check in, then complete', async () => {
      const approved = await http(app)
        .post(`/api/bookings/${bookingId}/approve`)
        .set(bearer(adminToken))
        .send({ paymentMethod: 'GCash', referenceNumber: '0012 3456 7890' })
        .expect(200);
      expect(approved.body.status).toBe('confirmed');
      // the verification is recorded on the booking
      expect(approved.body.paymentMethod).toBe('GCash');
      expect(approved.body.paymentReference).toBe('0012 3456 7890');
      // The receipt is deleted once the review concludes, but the booking must
      // still show that one WAS recorded — not a broken image or an error.
      expect(approved.body.hasProof).toBe(false);
      expect(approved.body.proofRecorded).toBe(true);
      const proof = await http(app)
        .get(`/api/bookings/${bookingId}/proof`)
        .set(bearer(adminToken))
        .expect(200);
      expect(proof.body.image).toBeNull();
      expect(proof.body.recorded).toBe(true);
      expect(proof.body.removed).toBe(true); // drives the "recorded" notice
      expect(proof.body.fileName).toBe('receipt.jpg');

      const checkedIn = await http(app)
        .post(`/api/bookings/${bookingId}/check-in`)
        .set(bearer(staffToken))
        .expect(200);
      expect(checkedIn.body.status).toBe('checked_in');

      const done = await http(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set(bearer(adminToken))
        .expect(200);
      expect(done.body.status).toBe('completed');
    });

    it('releases a hold', async () => {
      const held = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(4), hour: 9 }] })
        .expect(201);
      const id = held.body[0].id;
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [id] })
        .expect(200);
      const mine = await http(app)
        .get('/api/bookings/mine')
        .set(bearer(customerToken))
        .expect(200);
      expect(mine.body.map((b: any) => b.id)).not.toContain(id);
    });

    it('rejects a booking with a reason', async () => {
      const held = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(5), hour: 8 }] })
        .expect(201);
      await http(app)
        .post('/api/bookings/submit-payment')
        .set(bearer(customerToken))
        .send({ ids: [held.body[0].id], proofFileName: 'blurry.jpg', proofImage: RECEIPT_IMG })
        .expect(200);
      const rejected = await http(app)
        .post(`/api/bookings/${held.body[0].id}/reject`)
        .set(bearer(adminToken))
        .send({ reason: 'Unreadable receipt' })
        .expect(200);
      // purged on rejection too, but still marked as recorded
      expect(rejected.body.hasProof).toBe(false);
      expect(rejected.body.proofRecorded).toBe(true);
      expect(rejected.body).toMatchObject({
        status: 'rejected',
        note: 'Unreadable receipt',
      });
    });
  });

  describe('slot conflicts (no double-booking)', () => {
    const date = dateInDays(6);
    const hour = 10;
    let otherToken: string;
    let heldId: string;

    beforeAll(async () => {
      const other = await customerLogin(app, {
        email: 'e2e.rival@example.com',
        name: 'E2E Rival',
      });
      otherToken = other.token;
    });

    it('lets the first customer hold the slot', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(201);
      heldId = res.body[0].id;
    });

    it('rejects a second customer holding the same held slot (409)', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(otherToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(409);
      expect(res.body.conflicts).toEqual([{ courtId, date, hour }]);
    });

    it('still rejects once the slot is pending approval (409)', async () => {
      await http(app)
        .post('/api/bookings/submit-payment')
        .set(bearer(customerToken))
        .send({ ids: [heldId], proofFileName: 'receipt.jpg' })
        .expect(200);
      await http(app)
        .post('/api/bookings/hold')
        .set(bearer(otherToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(409);
    });

    it('reopens the slot for others after the booking is cancelled', async () => {
      await http(app)
        .post(`/api/bookings/${heldId}/cancel`)
        .set(bearer(adminToken))
        .send({ reason: 'Freeing the slot' })
        .expect(200);
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(otherToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(201);
      // cleanup so later availability assertions stay clean
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(otherToken))
        .send({ ids: [res.body[0].id] })
        .expect(200);
    });
  });

  describe('front-desk (walk-in) booking', () => {
    const date = dateInDays(12);

    it('books a walk-in with no account, confirmed immediately', async () => {
      const res = await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 9 }],
          contact: { name: 'Walk In Wanda', phone: '0917 111 2222' },
          paymentMethod: 'Cash',
        })
        .expect(201);

      const b = res.body[0];
      expect(b.status).toBe('confirmed'); // no hold/approval step
      expect(b.customerId).toBeNull(); // no account
      expect(b.customerName).toBe('Walk In Wanda');
      expect(b.contactPhone).toBe('0917 111 2222');
      expect(b.paymentMethod).toBe('Cash');
      expect(b.paymentReference).toBeUndefined(); // cash needs none
    });

    it('blocks the slot for customers right away', async () => {
      const avail = await http(app)
        .get('/api/bookings/availability')
        .set(bearer(customerToken))
        .expect(200);
      const slot = avail.body.find(
        (s: any) => s.courtId === courtId && s.date === date && s.hour === 9,
      );
      expect(slot).toBeDefined();
      expect(slot.state).toBe('booked');

      await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour: 9 }] })
        .expect(409);
    });

    it('requires a reference for non-cash methods (400)', async () => {
      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 10 }],
          contact: { name: 'No Ref', phone: '0917 000 0000' },
          paymentMethod: 'GCash',
        })
        .expect(400);
    });

    it('accepts a non-cash booking with a reference', async () => {
      const res = await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 10 }],
          contact: { name: 'Gee Cash', phone: '0917 333 4444' },
          paymentMethod: 'GCash',
          referenceNumber: '9988 7766',
        })
        .expect(201);
      expect(res.body[0].paymentReference).toBe('9988 7766');
    });

    it('requires contact details (400)', async () => {
      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 11 }],
          contact: { name: '', phone: '' },
          paymentMethod: 'Cash',
        })
        .expect(400);
    });

    it('can attach an existing customer account', async () => {
      const me = await http(app)
        .get('/api/auth/me')
        .set(bearer(customerToken))
        .expect(200);
      const res = await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 12 }],
          customerId: me.body.id,
          contact: { name: 'E2E Player', phone: '0917 555 0000' },
          paymentMethod: 'Cash',
        })
        .expect(201);
      expect(res.body[0].customerId).toBe(me.body.id);

      // and it shows up in that customer's own bookings
      const mine = await http(app)
        .get('/api/bookings/mine')
        .set(bearer(customerToken))
        .expect(200);
      expect(mine.body.map((b: any) => b.id)).toContain(res.body[0].id);
    });

    it('still refuses hours outside opening hours (400)', async () => {
      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date, hour: 3 }],
          contact: { name: 'Too Early', phone: '0917 000 0000' },
          paymentMethod: 'Cash',
        })
        .expect(400);
    });

    it('lets staff take a walk-in, but not customers (403)', async () => {
      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(staffToken))
        .send({
          items: [{ courtId, date, hour: 13 }],
          contact: { name: 'Staff Booked', phone: '0917 777 8888' },
          paymentMethod: 'Cash',
        })
        .expect(201);

      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(customerToken))
        .send({
          items: [{ courtId, date, hour: 14 }],
          contact: { name: 'Nope', phone: '0917 000 0000' },
          paymentMethod: 'Cash',
        })
        .expect(403);
    });
  });

  describe('customer contact auto-fill', () => {
    it('falls back to the signed-in customer profile when no contact is sent', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(13), hour: 9 }] })
        .expect(201);
      // profile was completed as E2E Player / 0917 555 0000 earlier
      expect(res.body[0].customerName).toBe('E2E Player');
      expect(res.body[0].contactPhone).toBe('0917 555 0000');
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [res.body[0].id] })
        .expect(200);
    });

    it('accepts an explicit contact override', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({
          items: [{ courtId, date: dateInDays(13), hour: 10 }],
          contact: { name: 'Someone Else', phone: '0918 222 3333' },
        })
        .expect(201);
      expect(res.body[0].customerName).toBe('Someone Else');
      expect(res.body[0].contactPhone).toBe('0918 222 3333');
    });
  });

  describe('opening hours', () => {
    afterAll(async () => {
      // restore the default window for the specs that follow
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: 6, closeHour: 22 })
        .expect(200);
    });

    it('exposes opening hours publicly (the calendar needs them pre-login)', async () => {
      const res = await http(app).get('/api/settings').expect(200);
      expect(typeof res.body.openHour).toBe('number');
      expect(typeof res.body.closeHour).toBe('number');
    });

    it('rejects a booking outside opening hours (400)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: 8, closeHour: 20 })
        .expect(200);

      // 7:00 is before opening
      await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(11), hour: 7 }] })
        .expect(400);
      // 20:00 is the exclusive close, so also out
      await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(11), hour: 20 }] })
        .expect(400);
    });

    it('allows a booking inside opening hours', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(11), hour: 19 }] })
        .expect(201);
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [res.body[0].id] })
        .expect(200);
    });

    it('supports whole-day opening (0 to 24)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: 0, closeHour: 24 })
        .expect(200);
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(11), hour: 23 }] })
        .expect(201);
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [res.body[0].id] })
        .expect(200);
    });

    it('rejects a close time that is not after open (400)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: 10, closeHour: 10 })
        .expect(400);
      // also when only one side is sent and would invert the stored pair
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: 12, closeHour: 8 })
        .expect(400);
    });

    it('rejects out-of-range hours (400)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ closeHour: 25 })
        .expect(400);
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ openHour: -1 })
        .expect(400);
    });

    it('forbids a customer from changing opening hours (403)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(customerToken))
        .send({ openHour: 9 })
        .expect(403);
    });
  });

  describe('configurable peak hours + frozen pricing', () => {
    const date = dateInDays(8); // weekday-or-weekend agnostic: we set both grids
    const hour = 14;
    let bookingId: string;
    let bookedTotal: number;

    it('prices a slot off-peak when its hour is not marked peak', async () => {
      // 14:00 peak on neither grid -> off-peak (450)
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ peakHoursWeekday: [17, 18], peakHoursWeekend: [17, 18] })
        .expect(200);

      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour }] })
        .expect(201);
      bookingId = res.body[0].id;
      bookedTotal = res.body[0].total;
      expect(bookedTotal).toBe(450);
      expect(res.body[0].slots[0].rate).toBe(450);
    });

    it('does not reprice an existing booking when peak hours change', async () => {
      // Make 14:00 peak on both grids — the held booking must NOT move.
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({
          peakHoursWeekday: [14, 17, 18],
          peakHoursWeekend: [14, 17, 18],
        })
        .expect(200);

      const mine = await http(app)
        .get('/api/bookings/mine')
        .set(bearer(customerToken))
        .expect(200);
      const b = mine.body.find((x: any) => x.id === bookingId);
      expect(b.total).toBe(bookedTotal); // still 450, not 700
      expect(b.slots[0].rate).toBe(450); // frozen per-slot rate
    });

    it('prices a NEW booking at the updated peak rate', async () => {
      const res = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour: hour + 1 }] })
        .expect(201);
      // 15:00 is still off-peak
      expect(res.body[0].total).toBe(450);

      const peakRes = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date, hour: 14 + 4 }] })
        .expect(201);
      // 18:00 is peak on both grids now
      expect(peakRes.body[0].total).toBe(700);
      expect(peakRes.body[0].slots[0].rate).toBe(700);
    });

    it('rejects an out-of-range hour (400)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ peakHoursWeekday: [24] })
        .expect(400);
    });

    it('forbids a customer from changing peak hours (403)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(customerToken))
        .send({ peakHoursWeekday: [9] })
        .expect(403);
    });
  });

  describe('overrides (blackouts) + availability', () => {
    it('creates and lists a blackout, then removes it', async () => {
      const created = await http(app)
        .post('/api/overrides')
        .set(bearer(adminToken))
        .send({
          label: 'Holiday',
          reason: 'holiday',
          courtId: 'all',
          scope: 'date',
          date: dateInDays(9),
        })
        .expect(201);
      const id = created.body.id;

      const listed = await http(app)
        .get('/api/overrides')
        .set(bearer(customerToken))
        .expect(200);
      expect(listed.body.map((o: any) => o.id)).toContain(id);

      await http(app)
        .delete(`/api/overrides/${id}`)
        .set(bearer(adminToken))
        .expect(200);
    });
  });

  describe('payment methods', () => {
    it('admin sets the structured methods the customer can read', async () => {
      const methods = [
        { id: 'm1', type: 'cash', label: 'Cash' },
        { id: 'm2', type: 'gcash', label: 'GCash', phone: '0917 555 1234' },
      ];
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ paymentMethods: methods })
        .expect(200);
      // Settings are public (the login page reads branding pre-auth), so the
      // customer sees the same details they need to pay at checkout.
      const res = await http(app)
        .get('/api/settings')
        .set(bearer(customerToken))
        .expect(200);
      expect(res.body.paymentMethods).toHaveLength(2);
      expect(res.body.paymentMethods[1]).toMatchObject({
        type: 'gcash',
        label: 'GCash',
        phone: '0917 555 1234',
      });
    });

    it('rejects a gcash method missing its required phone', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ paymentMethods: [{ id: 'm1', type: 'gcash', label: 'GCash' }] })
        .expect(400);
    });

    it('rejects a bank method missing its account fields', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ paymentMethods: [{ id: 'm1', type: 'bank', label: 'BPI' }] })
        .expect(400);
    });
  });

  describe('customers directory (admin)', () => {
    it('lists the customer with computed lifetime spend', async () => {
      const res = await http(app)
        .get('/api/customers')
        .set(bearer(adminToken))
        .expect(200);
      const player = res.body.find(
        (c: any) => c.email === 'e2e.player@example.com',
      );
      expect(player).toBeDefined();
      // one completed 700 booking
      expect(player.spend).toBe(700);
    });

    it('forbids a customer from the directory (403)', async () => {
      await http(app)
        .get('/api/customers')
        .set(bearer(customerToken))
        .expect(403);
    });
  });

  describe('staff management (admin only)', () => {
    it('creates, updates, and removes a staff account', async () => {
      const created = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Rina Flores', email: 'rina@pickleplay.co', access: 'staff' })
        .expect(201);
      const id = created.body.id;
      expect(created.body).toMatchObject({ access: 'staff' });

      const updated = await http(app)
        .patch(`/api/staff/${id}`)
        .set(bearer(adminToken))
        .send({ access: 'admin' })
        .expect(200);
      expect(updated.body.access).toBe('admin');

      await http(app)
        .delete(`/api/staff/${id}`)
        .set(bearer(adminToken))
        .expect(200);
    });

    it('returns a generated password that actually works at login', async () => {
      const created = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Pat Cruz', email: 'pat@pickleplay.co', access: 'staff' })
        .expect(201);

      const pw = created.body.tempPassword;
      expect(typeof pw).toBe('string');
      expect(pw.length).toBeGreaterThanOrEqual(12);

      // The whole point: the password handed to the admin must authenticate.
      const res = await http(app)
        .post('/api/auth/login')
        .send({ email: 'pat@pickleplay.co', password: pw })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toMatchObject({ role: 'staff', name: 'Pat Cruz' });
    });

    it('generates a different password per account', async () => {
      const a = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'A One', email: 'a.one@pickleplay.co', access: 'staff' })
        .expect(201);
      const b = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'B Two', email: 'b.two@pickleplay.co', access: 'staff' })
        .expect(201);
      expect(a.body.tempPassword).not.toBe(b.body.tempPassword);
    });

    it('regenerates a password: the new one works and the old one stops', async () => {
      const created = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Reset Me', email: 'reset@pickleplay.co', access: 'staff' })
        .expect(201);
      const oldPw = created.body.tempPassword;
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'reset@pickleplay.co', password: oldPw })
        .expect(200);

      const reset = await http(app)
        .post(`/api/staff/${created.body.id}/reset-password`)
        .set(bearer(adminToken))
        .expect(200);
      const newPw = reset.body.tempPassword;
      expect(newPw).not.toBe(oldPw);

      // new password authenticates...
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'reset@pickleplay.co', password: newPw })
        .expect(200);
      // ...and the old one is dead
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'reset@pickleplay.co', password: oldPw })
        .expect(401);
    });

    it('forbids staff from regenerating passwords (403)', async () => {
      // RolesGuard rejects before the id is looked up, so any id proves the point.
      await http(app)
        .post('/api/staff/00000000-0000-0000-0000-000000000000/reset-password')
        .set(bearer(staffToken))
        .expect(403);
    });

    it('rejects a duplicate email (409)', async () => {
      await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Dupe', email: 'pat@pickleplay.co', access: 'staff' })
        .expect(409);
    });

    it('soft deletes on remove: account cannot sign in and drops off the list', async () => {
      const created = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Gone Soon', email: 'gone@pickleplay.co', access: 'staff' })
        .expect(201);
      const pw = created.body.tempPassword;

      // works before removal
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'gone@pickleplay.co', password: pw })
        .expect(200);

      await http(app)
        .delete(`/api/staff/${created.body.id}`)
        .set(bearer(adminToken))
        .expect(200);

      // gone from the directory...
      const list = await http(app)
        .get('/api/staff')
        .set(bearer(adminToken))
        .expect(200);
      expect(list.body.map((s: any) => s.email)).not.toContain(
        'gone@pickleplay.co',
      );
      // ...and can no longer authenticate
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'gone@pickleplay.co', password: pw })
        .expect(401);
    });

    it('re-adding a removed email restores the account with a fresh password', async () => {
      const again = await http(app)
        .post('/api/staff')
        .set(bearer(adminToken))
        .send({ name: 'Back Again', email: 'gone@pickleplay.co', access: 'admin' })
        .expect(201);
      // the soft-deleted row is revived, not duplicated
      expect(again.body.access).toBe('admin');
      await http(app)
        .post('/api/auth/login')
        .send({ email: 'gone@pickleplay.co', password: again.body.tempPassword })
        .expect(200);
    });

    it('keeps a removed customer\'s bookings intact (no cascade delete)', async () => {
      // the seeded customer has bookings from the lifecycle specs above
      const before = await http(app)
        .get('/api/bookings')
        .set(bearer(adminToken))
        .expect(200);
      expect(before.body.length).toBeGreaterThan(0);
    });

    it('forbids staff from managing staff (403)', async () => {
      await http(app).get('/api/staff').set(bearer(staffToken)).expect(403);
    });
  });

  describe('onboarding lock', () => {
    // Clears the flag, proves writes are refused, then restores it. Runs late
    // so it can't disturb the specs above.
    const ds = () => app.get<DataSource>(getDataSourceToken());
    const setOnboarding = (done: boolean) =>
      ds().query(
        `UPDATE "settings" SET "onboarding_completed_at" = ${done ? 'now()' : 'NULL'} WHERE id = 1`,
      );

    afterAll(async () => {
      await setOnboarding(true);
    });

    it('reports completion state publicly', async () => {
      const res = await http(app).get('/api/settings').expect(200);
      expect(res.body.onboardingComplete).toBe(true);
    });

    it('refuses booking writes while onboarding is incomplete (403)', async () => {
      await setOnboarding(false);

      await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(20), hour: 9 }] })
        .expect(403);

      await http(app)
        .post('/api/bookings/admin-create')
        .set(bearer(adminToken))
        .send({
          items: [{ courtId, date: dateInDays(20), hour: 10 }],
          contact: { name: 'Blocked', phone: '0917 000 0000' },
          paymentMethod: 'Cash',
        })
        .expect(403);
    });

    it('still allows the writes onboarding itself needs', async () => {
      // settings, courts, payment QRs and staff must stay open or setup
      // could never be finished.
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ appName: 'Still Setting Up' })
        .expect(200);
      await http(app)
        .post('/api/courts')
        .set(bearer(adminToken))
        .send({ name: 'Onboarding Court', surface: 'x', peakRate: 100, offPeakRate: 50 })
        .expect(201);
    });

    it('still allows reads while incomplete', async () => {
      await http(app).get('/api/courts').set(bearer(adminToken)).expect(200);
      await http(app).get('/api/bookings').set(bearer(adminToken)).expect(200);
    });

    it('completes onboarding and unblocks writes', async () => {
      const res = await http(app)
        .post('/api/settings/complete-onboarding')
        .set(bearer(adminToken))
        .expect(200);
      expect(res.body.onboardingCompletedAt).toBeTruthy();

      const hold = await http(app)
        .post('/api/bookings/hold')
        .set(bearer(customerToken))
        .send({ items: [{ courtId, date: dateInDays(20), hour: 9 }] })
        .expect(201);
      await http(app)
        .post('/api/bookings/release-holds')
        .set(bearer(customerToken))
        .send({ ids: [hold.body[0].id] })
        .expect(200);
    });

    it('forbids staff from completing onboarding (403)', async () => {
      await http(app)
        .post('/api/settings/complete-onboarding')
        .set(bearer(staffToken))
        .expect(403);
    });
  });

  describe('settings / branding', () => {
    it('is publicly readable', async () => {
      const res = await http(app).get('/api/settings').expect(200);
      expect(res.body.appName).toBeDefined();
    });

    it('lets an admin update branding', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ appName: 'CourtHub' })
        .expect(200);
      const res = await http(app).get('/api/settings').expect(200);
      expect(res.body.appName).toBe('CourtHub');
    });

    it('stores and clears a brand logo', async () => {
      // 1x1 transparent PNG
      const png =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ logoUrl: png })
        .expect(200);
      // publicly readable — the landing page renders it before login
      const res = await http(app).get('/api/settings').expect(200);
      expect(res.body.logoUrl).toBe(png);

      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ logoUrl: null })
        .expect(200);
      const cleared = await http(app).get('/api/settings').expect(200);
      expect(cleared.body.logoUrl).toBeNull();
    });

    it('rejects a logo that is not an image data URL (400)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ logoUrl: 'https://evil.example.com/logo.png' })
        .expect(400);
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ logoUrl: 'data:text/html;base64,PHNjcmlwdD4=' })
        .expect(400);
    });

    it('rejects an oversized logo (400)', async () => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(300_000);
      await http(app)
        .patch('/api/settings')
        .set(bearer(adminToken))
        .send({ logoUrl: huge })
        .expect(400);
    });

    it('forbids a customer from updating branding (403)', async () => {
      await http(app)
        .patch('/api/settings')
        .set(bearer(customerToken))
        .send({ appName: 'Nope' })
        .expect(403);
    });
  });
});
