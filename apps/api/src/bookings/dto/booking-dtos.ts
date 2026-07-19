import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SlotItemDto {
  @ApiProperty()
  @IsString()
  courtId: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsString()
  date: string;

  @ApiProperty({ example: 18 })
  @IsInt()
  hour: number;
}

// Who to contact about the booking.
export class ContactDto {
  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a contact name.' })
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '0917 123 4567' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a contact number.' })
  @MaxLength(40)
  phone: string;

  @ApiPropertyOptional({ example: 'maria@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;
}

export class HoldDto {
  @ApiProperty({ type: [SlotItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SlotItemDto)
  items: SlotItemDto[];

  // Optional: the API falls back to the signed-in customer's profile.
  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;
}

// Front-desk booking. Skips hold/approval: the money is taken at the counter,
// so the booking is created already confirmed.
export class AdminCreateBookingDto {
  @ApiProperty({ type: [SlotItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SlotItemDto)
  items: SlotItemDto[];

  // Optional: a walk-in may not have an account. Contact details still required.
  @ApiPropertyOptional({ example: 'uuid-of-existing-customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @ApiProperty({ example: 'Cash' })
  @IsString()
  @IsNotEmpty({ message: 'Select the payment method.' })
  @MaxLength(60)
  paymentMethod: string;

  // Cash has no transaction number; every other method must have one.
  @ApiPropertyOptional({ example: '0012 3456 7890' })
  @ValidateIf((o) => String(o.paymentMethod ?? '').trim().toLowerCase() !== 'cash')
  @IsString()
  @IsNotEmpty({ message: 'Enter the payment reference number.' })
  @MaxLength(80)
  referenceNumber?: string;
}

export class CreateBookingsDto {
  @ApiProperty({ type: [SlotItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SlotItemDto)
  items: SlotItemDto[];

  @ApiProperty({ example: 'gcash_receipt.jpg' })
  @IsString()
  proofFileName: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,/9j/4AAQ...' })
  @IsOptional()
  @IsString()
  @Matches(/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Receipt must be a PNG, JPEG, WEBP or PDF.',
  })
  @MaxLength(3_500_000, { message: 'That receipt is too large. Use a smaller image.' })
  proofImage?: string;
}

// A receipt image/PDF as a data: URL. Capped because it rides inline in the DB
// (no object storage yet) — the client downscales images before sending.
const PROOF_MAX_CHARS = 3_500_000; // ~2.5 MB after base64
const PROOF_PATTERN = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

export class SubmitPaymentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ example: 'gcash_receipt.jpg' })
  @IsString()
  proofFileName: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,/9j/4AAQ...' })
  @IsOptional()
  @IsString()
  @Matches(PROOF_PATTERN, { message: 'Receipt must be a PNG, JPEG, WEBP or PDF.' })
  @MaxLength(PROOF_MAX_CHARS, { message: 'That receipt is too large. Use a smaller image.' })
  proofImage?: string;
}

export class ReleaseHoldsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

// Approving confirms the money actually arrived, so both fields are required —
// the admin must have looked the payment up to fill them in.
export class ApproveDto {
  @ApiProperty({ example: 'GCash' })
  @IsString()
  @IsNotEmpty({ message: 'Select the payment method used.' })
  @MaxLength(60)
  paymentMethod: string;

  @ApiProperty({ example: '0012 3456 7890' })
  @IsString()
  @IsNotEmpty({ message: 'Enter the payment reference number.' })
  @MaxLength(80)
  referenceNumber: string;
}

export class ReasonDto {
  @ApiProperty({ example: 'Receipt image was unreadable.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}

// --- Guest booking (no account) ---------------------------------------------
// A guest has no JWT, so contact is required (there's no profile to fall back
// to), and ownership on later calls is proved by the returned guestToken.

export class GuestHoldDto {
  @ApiProperty({ type: [SlotItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SlotItemDto)
  items: SlotItemDto[];

  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;
}

export class GuestSubmitPaymentDto {
  @ApiProperty({ example: 'g_AbC123…' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  guestToken: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ example: 'gcash_receipt.jpg' })
  @IsString()
  proofFileName: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,/9j/4AAQ...' })
  @IsOptional()
  @IsString()
  @Matches(PROOF_PATTERN, { message: 'Receipt must be a PNG, JPEG, WEBP or PDF.' })
  @MaxLength(PROOF_MAX_CHARS, { message: 'That receipt is too large. Use a smaller image.' })
  proofImage?: string;
}

export class GuestReleaseHoldsDto {
  @ApiProperty({ example: 'g_AbC123…' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  guestToken: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

// Guest "my bookings" / claim: a browser presents the tokens it's holding.
export class GuestTokensDto {
  @ApiProperty({ type: [String], example: ['g_AbC123…'] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  tokens: string[];
}
