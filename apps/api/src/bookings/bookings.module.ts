import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingSlot } from './booking-slot.entity';
import { Court } from '../courts/court.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingSlot, Court]),
    // pricing reads the facility's peak-hour schedule
    SettingsModule,
    // contact auto-fill + resolving an optional walk-in customer
    UsersModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, RolesGuard],
  exports: [BookingsService],
})
export class BookingsModule {}
