import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  // admin/staff account with a password
  async create(
    email: string,
    password: string,
    opts: { role?: UserRole; name?: string } = {},
  ): Promise<User> {
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(password, rounds);
    const user = this.userRepo.create({
      email,
      passwordHash,
      role: opts.role ?? 'admin',
      name: opts.name ?? '',
    });
    return this.userRepo.save(user);
  }

  /**
   * Resolve a verified Google identity to a customer account.
   *
   * Lookup order matters: `google_sub` first, so someone who changed their
   * Gmail address keeps their existing account, then verified email, which
   * adopts accounts created before this column existed.
   *
   * Returns null when the email belongs to an admin or staff account —
   * those sign in with a password, and silently upgrading a Google sign-in
   * into a console session would be a privilege escalation. The caller turns
   * this into a 401.
   */
  async upsertGoogleCustomer(identity: {
    sub: string;
    email: string;
    name: string;
  }): Promise<User | null> {
    const bySub = await this.userRepo.findOne({
      where: { googleSub: identity.sub },
    });
    if (bySub) {
      if (bySub.role !== 'customer') return null;
      // Google is the source of truth for the address on this account — but
      // only adopt the new one if it's free. Renaming into an address another
      // row already holds would hit the unique constraint and 500 the sign-in;
      // keeping the stale email lets them in, which is the better failure.
      if (bySub.email !== identity.email) {
        const taken = await this.findByEmail(identity.email);
        if (!taken) {
          await this.userRepo.update(bySub.id, { email: identity.email });
          bySub.email = identity.email;
        }
      }
      return bySub;
    }

    const byEmail = await this.findByEmail(identity.email);
    if (byEmail) {
      if (byEmail.role !== 'customer') return null;
      // Claim the pre-existing customer row for this Google account.
      await this.userRepo.update(byEmail.id, { googleSub: identity.sub });
      byEmail.googleSub = identity.sub;
      return byEmail;
    }

    return this.userRepo.save(
      this.userRepo.create({
        email: identity.email,
        googleSub: identity.sub,
        passwordHash: null,
        role: 'customer',
        name: identity.name,
        phone: null,
      }),
    );
  }

  async updateProfile(id: string, name: string, phone: string): Promise<User> {
    await this.userRepo.update(id, { name, phone });
    return (await this.findById(id))!;
  }

  listCustomers(): Promise<User[]> {
    return this.userRepo.find({
      where: { role: 'customer' },
      order: { createdAt: 'DESC' },
    });
  }

  // staff directory = admin + staff accounts
  listStaff(): Promise<User[]> {
    return this.userRepo.find({
      where: { role: In(['admin', 'staff']) },
      order: { createdAt: 'ASC' },
    });
  }

  async setRole(id: string, role: UserRole): Promise<User> {
    await this.userRepo.update(id, { role });
    return (await this.findById(id))!;
  }

  // Replace an account's password with a new one, invalidating the old. findById
  // filters soft-deleted rows, so a removed account can't be reset.
  async setPassword(id: string, password: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    user.passwordHash = await bcrypt.hash(password, rounds);
    return this.userRepo.save(user);
  }

  // Soft delete: stamps deleted_at instead of issuing a DELETE. A hard delete
  // would cascade through FK_bookings_customer and destroy the user's entire
  // booking + payment history.
  async remove(id: string): Promise<void> {
    await this.userRepo.softDelete(id);
  }

  // Re-adding an email that belongs to a removed account restores that row
  // rather than inserting a duplicate — the unique email index still covers
  // soft-deleted rows, so a plain insert would violate it.
  async createOrRestore(
    email: string,
    password: string,
    opts: { role?: UserRole; name?: string } = {},
  ): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { email },
      withDeleted: true,
    });
    if (!existing) return this.create(email, password, opts);
    if (!existing.deletedAt) {
      throw new ConflictException(`${email} is already registered.`);
    }
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    existing.passwordHash = await bcrypt.hash(password, rounds);
    existing.deletedAt = null;
    if (opts.role) existing.role = opts.role;
    if (opts.name !== undefined) existing.name = opts.name;
    return this.userRepo.save(existing);
  }
}
