import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiAuthGuard } from '../common/guards/api-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public — branding (app name + colors) recolors the whole app, including
  // the landing and login pages shown before authentication.
  @Get()
  async get() {
    const s = await this.settingsService.get();
    // Flatten the timestamp to a boolean the console can branch on.
    return { ...s, onboardingComplete: !!s.onboardingCompletedAt };
  }

  @Patch()
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }

  // Admin finishes first-run setup. Prerequisites are validated server-side.
  @Post('complete-onboarding')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  completeOnboarding() {
    return this.settingsService.completeOnboarding();
  }
}
