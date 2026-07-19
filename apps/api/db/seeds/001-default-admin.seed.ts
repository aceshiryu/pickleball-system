import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../src/users/user.entity';

// The ONLY seeded record: a single admin account. Staff are created from the
// admin console (User management); no demo courts/bookings/customers are seeded.
// Override via env for a real deploy and change the password after first login.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@pickleplay.co';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'P@ssw0rd123';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Admin';

export async function run(ds: DataSource) {
  const userRepo = ds.getRepository(User);
  // withDeleted: the unique email index still covers soft-deleted rows, so a
  // plain insert could collide with a previously removed admin.
  const existing = await userRepo.findOne({
    where: { email: ADMIN_EMAIL },
    withDeleted: true,
  });
  if (existing) {
    console.log(`  Skipped: ${ADMIN_EMAIL} already exists.`);
    return;
  }
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, rounds);
  await userRepo.save(
    userRepo.create({
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      name: ADMIN_NAME,
    }),
  );
  console.log(`  Created admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('  Change this password after first login before any non-local deploy.');
}
