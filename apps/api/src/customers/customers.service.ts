import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Booking } from '../bookings/booking.entity';

// Lifetime spend counts bookings that were actually played/paid.
const SPEND_STATUSES = ['confirmed', 'checked_in', 'completed'];

@Injectable()
export class CustomersService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async listWithSpend() {
    const customers = await this.usersService.listCustomers();

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.customer_id', 'customerId')
      .addSelect('SUM(b.total)', 'spend')
      .where('b.status IN (:...statuses)', { statuses: SPEND_STATUSES })
      .groupBy('b.customer_id')
      .getRawMany<{ customerId: string; spend: string }>();

    const spendByCustomer = new Map(
      rows.map((r) => [r.customerId, Number(r.spend) || 0]),
    );

    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? '',
      joinedAt: c.createdAt.toISOString(),
      spend: spendByCustomer.get(c.id) ?? 0,
    }));
  }
}
