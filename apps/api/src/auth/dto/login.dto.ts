import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  // No length rule here: a password policy belongs on registration. Enforcing
  // one at login turns a wrong short password into a 400 that lectures the user
  // about length instead of a plain "incorrect email or password" 401.
  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty({ message: 'Enter your password.' })
  password: string;
}
