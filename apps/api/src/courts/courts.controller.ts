import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiAuthGuard } from '../common/guards/api-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@ApiTags('courts')
@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  // Public: the customer booking calendar (guests included) needs the court
  // list — names and rates, no sensitive data. Mutations below stay admin-only.
  @Get()
  findAll() {
    return this.courtsService.findAll();
  }

  // Admin-only: create a court from the console (Court management → Add a court).
  @Post()
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateCourtDto) {
    return this.courtsService.update(id, dto);
  }

  @Post(':id/toggle-maintenance')
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  toggleMaintenance(@Param('id') id: string) {
    return this.courtsService.toggleMaintenance(id);
  }
}
