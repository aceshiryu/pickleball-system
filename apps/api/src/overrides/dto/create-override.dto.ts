import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import type {
  OverrideReason,
  OverrideScope,
} from '../override.entity';

export class CreateOverrideDto {
  @ApiProperty({ example: 'Holiday closure' })
  @IsString()
  label: string;

  @ApiProperty({
    enum: ['maintenance', 'holiday', 'private_event', 'other'],
    example: 'holiday',
  })
  @IsIn(['maintenance', 'holiday', 'private_event', 'other'])
  reason: OverrideReason;

  @ApiProperty({ example: 'all', description: '"all" or a court uuid' })
  @IsString()
  courtId: string;

  @ApiProperty({ enum: ['date', 'hours', 'week'], example: 'date' })
  @IsIn(['date', 'hours', 'week'])
  scope: OverrideScope;

  @ApiProperty({ example: '2026-07-14' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  startHour?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  endHour?: number;
}
