import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CompleteProfileDto {
  @ApiProperty({ example: 'Jordan Reyes' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '0917 555 0142' })
  @IsString()
  @MinLength(5)
  phone: string;
}
