import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiAuthGuard } from '../common/guards/api-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOverrideDto } from './dto/create-override.dto';
import { OverridesService } from './overrides.service';

@ApiTags('overrides')
@Controller('overrides')
export class OverridesController {
  constructor(private readonly overridesService: OverridesService) {}

  // Any authenticated user (customers must see blackouts).
  @Get()
  @UseGuards(ApiAuthGuard)
  @ApiBearerAuth()
  findAll() {
    return this.overridesService.findAll();
  }

  @Post()
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  create(@Body() dto: CreateOverrideDto) {
    return this.overridesService.create(dto);
  }

  @Delete(':id')
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.overridesService.remove(id);
  }
}
