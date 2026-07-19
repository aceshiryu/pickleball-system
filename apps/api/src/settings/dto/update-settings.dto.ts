import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodDto } from './payment-method.dto';

// The logo rides inline as a data: URL, so cap it. ~256KB of base64 is a
// generous 256x256 PNG and keeps the (public, every-page) settings payload sane.
const LOGO_MAX_CHARS = 262_144;

// Mirrors the catalogue in the web app's lib/fonts.ts.
const FONT_KEYS = ['space-grotesk', 'inter', 'poppins', 'dm-sans', 'outfit', 'system'];

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'AfterHours' })
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiPropertyOptional({ example: '#6B2B2B' })
  @IsOptional()
  @IsString()
  primary?: string;

  @ApiPropertyOptional({ example: '#6E7275' })
  @IsOptional()
  @IsString()
  secondary?: string;

  // Square logo as a data: URL. Send null to clear it.
  @ApiPropertyOptional({ example: 'data:image/png;base64,iVBORw0KG...' })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Logo must be a PNG, JPEG or WEBP image.',
  })
  @MaxLength(LOGO_MAX_CHARS, { message: 'That logo is too large. Use a smaller image.' })
  logoUrl?: string | null;

  @ApiPropertyOptional({ enum: FONT_KEYS })
  @IsOptional()
  @IsIn(FONT_KEYS, { message: 'Unknown font.' })
  fontFamily?: string;

  // First bookable hour. 0 with closeHour 24 = open all day.
  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  openHour?: number;

  // Exclusive: the last bookable slot starts at closeHour - 1.
  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  closeHour?: number;

  @ApiPropertyOptional({ example: [17, 18, 19, 20, 21], type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  peakHoursWeekday?: number[];

  @ApiPropertyOptional({ example: [8, 9, 10, 11], type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  peakHoursWeekend?: number[];

  // Accepted payment methods as structured objects (see PaymentMethodDto). Sent
  // as a whole list, not patched item-by-item, so removing one is just a shorter
  // array. Each object is validated per-type (phone for e-wallets, account
  // fields for bank).
  @ApiPropertyOptional({ type: [PaymentMethodDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];
}
