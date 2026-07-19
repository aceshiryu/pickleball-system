import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * The `credential` handed back by Google Identity Services in the browser — a
 * signed JWT. The server verifies it; nothing about the caller's identity is
 * taken from the request body.
 */
export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token (the GIS `credential` value)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  @MinLength(20)
  idToken: string;
}
