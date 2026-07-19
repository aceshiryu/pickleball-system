import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateStaffDto {
  @ApiProperty({ example: 'admin', enum: ['admin', 'staff'] })
  @IsIn(['admin', 'staff'])
  access: 'admin' | 'staff';
}
