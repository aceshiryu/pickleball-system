import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiAuthGuard } from '../common/guards/api-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import {
  AdminCreateBookingDto,
  ApproveDto,
  CreateBookingsDto,
  HoldDto,
  ReasonDto,
  ReleaseHoldsDto,
  SubmitPaymentDto,
} from './dto/booking-dtos';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // --- admin / staff ---
  @Get()
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  findAll() {
    return this.bookingsService.findAllForAdmin();
  }

  // --- customer ---
  @Get('mine')
  @UseGuards(ApiAuthGuard)
  findMine(@CurrentUser() user: CurrentUserPayload) {
    return this.bookingsService.findMine(user.sub);
  }

  @Get('availability')
  @UseGuards(ApiAuthGuard)
  availability() {
    return this.bookingsService.availability();
  }

  @Post('hold')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiAuthGuard)
  hold(@CurrentUser() user: CurrentUserPayload, @Body() dto: HoldDto) {
    return this.bookingsService.hold(user.sub, dto.items, dto.contact);
  }

  // --- front desk ---
  // Walk-in / phone booking taken at the counter. Money is collected there, so
  // this creates a confirmed booking directly and blocks the slot immediately.
  @Post('admin-create')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  adminCreate(@Body() dto: AdminCreateBookingDto) {
    return this.bookingsService.adminCreate(dto);
  }

  @Post('submit-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard)
  submitPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.bookingsService.submitPayment(
      user.sub,
      dto.ids,
      dto.proofFileName,
      dto.proofImage,
    );
  }

  // Receipt image, fetched on demand (kept out of list payloads). Admin/staff,
  // or the owning customer.
  @Get(':id/proof')
  @UseGuards(ApiAuthGuard)
  proof(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.bookingsService.proofFor(id, { sub: user.sub, role: user.role });
  }

  @Post()
  @UseGuards(ApiAuthGuard)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBookingsDto,
  ) {
    return this.bookingsService.createBookings(
      user.sub,
      dto.items,
      dto.proofFileName,
      dto.proofImage,
    );
  }

  @Post('release-holds')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard)
  async releaseHolds(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReleaseHoldsDto,
  ) {
    await this.bookingsService.releaseHolds(user.sub, dto.ids);
    return { released: true };
  }

  // --- admin / staff actions ---
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  approve(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.bookingsService.approve(
      id,
      dto.paymentMethod,
      dto.referenceNumber,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  reject(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.bookingsService.reject(id, dto.reason ?? '');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  cancel(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.bookingsService.cancel(id, dto.reason ?? '');
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  checkIn(@Param('id') id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  complete(@Param('id') id: string) {
    return this.bookingsService.complete(id);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  noShow(@Param('id') id: string) {
    return this.bookingsService.noShow(id);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  acknowledge(@Param('id') id: string) {
    return this.bookingsService.acknowledge(id);
  }
}
