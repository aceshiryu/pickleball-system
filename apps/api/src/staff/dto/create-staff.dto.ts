import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ example: 'Jamie Cruz' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'jamie@pickleplay.co' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'staff', enum: ['admin', 'staff'] })
  @IsIn(['admin', 'staff'])
  access: 'admin' | 'staff';
}
