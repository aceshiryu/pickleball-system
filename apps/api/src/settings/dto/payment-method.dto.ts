import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodType } from '../payment-method.interface';

// A QR rides inline as a data: URL like the logo, so cap it. QR codes are
// small, so a tighter cap than the logo is plenty and keeps the settings
// payload (public, sent on every page) reasonable across several methods.
const QR_MAX_CHARS = 131_072; // ~128KB of base64

const TYPES: PaymentMethodType[] = ['gcash', 'maya', 'bank', 'cash', 'other'];

// Conditional required-ness by type is enforced with @ValidateIf: phone for
// e-wallets, the three account fields for bank. Everything else is optional so
// cash/other stay label-only. The web form guards the same rules first; this is
// the server-side backstop.
export class PaymentMethodDto {
  @ApiProperty({ example: 'm_a1b2c3' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id: string;

  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES, { message: 'Unknown payment method type.' })
  type: PaymentMethodType;

  @ApiProperty({ example: 'GCash' })
  @IsString()
  @MinLength(1, { message: 'Payment method needs a name.' })
  @MaxLength(60)
  label: string;

  // Required for gcash/maya.
  @ApiPropertyOptional({ example: '0917 123 4567' })
  @ValidateIf((o: PaymentMethodDto) => o.type === 'gcash' || o.type === 'maya')
  @IsString()
  @MinLength(1, { message: 'Enter the mobile number for this e-wallet.' })
  @MaxLength(40)
  phone?: string;

  // The three below are required for bank.
  @ApiPropertyOptional({ example: 'BPI' })
  @ValidateIf((o: PaymentMethodDto) => o.type === 'bank')
  @IsString()
  @MinLength(1, { message: 'Enter the bank name.' })
  @MaxLength(60)
  bankName?: string;

  @ApiPropertyOptional({ example: '1234-5678-90' })
  @ValidateIf((o: PaymentMethodDto) => o.type === 'bank')
  @IsString()
  @MinLength(1, { message: 'Enter the account number.' })
  @MaxLength(60)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Juan Dela Cruz' })
  @ValidateIf((o: PaymentMethodDto) => o.type === 'bank')
  @IsString()
  @MinLength(1, { message: 'Enter the account name.' })
  @MaxLength(80)
  accountName?: string;

  // Optional QR for any non-cash method. null clears it.
  @ApiPropertyOptional({ example: 'data:image/png;base64,iVBORw0KG...' })
  @IsOptional()
  @ValidateIf((o: PaymentMethodDto) => o.qr !== null && o.qr !== undefined)
  @IsString()
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'QR must be a PNG, JPEG or WEBP image.',
  })
  @MaxLength(QR_MAX_CHARS, { message: 'That QR image is too large. Use a smaller image.' })
  qr?: string | null;
}
