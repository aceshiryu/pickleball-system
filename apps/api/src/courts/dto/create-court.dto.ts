import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateCourtDto {
  @ApiProperty({ example: 'Center Court' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'hardcourt' })
  @IsString()
  @MinLength(1)
  surface: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  peakRate: number;

  @ApiProperty({ example: 300 })
  @IsInt()
  @Min(0)
  offPeakRate: number;
}
