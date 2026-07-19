import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import type { CourtStatus } from '../court.entity';

export class UpdateCourtDto {
  @ApiPropertyOptional({ example: 'Center Court' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'hardcourt' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  surface?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  peakRate?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offPeakRate?: number;

  @ApiPropertyOptional({ enum: ['active', 'maintenance'] })
  @IsOptional()
  @IsIn(['active', 'maintenance'])
  status?: CourtStatus;
}
