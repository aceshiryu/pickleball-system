import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'MCP server (laptop)' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}
