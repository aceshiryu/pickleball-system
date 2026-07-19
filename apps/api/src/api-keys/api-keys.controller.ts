import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';

/**
 * Admin-only, and deliberately guarded with JwtAuthGuard rather than
 * ApiAuthGuard: an API key must not be able to mint more API keys. Issuing
 * credentials requires a human session.
 */
@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List your API keys (never returns the key itself)' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.apiKeys.listView(user.sub);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an API key — the raw key is returned once and never again',
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(user.sub, dto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.apiKeys.revoke(user.sub, id);
  }
}
