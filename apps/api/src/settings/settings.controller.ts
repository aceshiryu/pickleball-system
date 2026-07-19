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
import { PublicKeyGuard } from '../common/guards/public-key.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Web-key gated — branding (app name + colors) recolors the whole app,
  // including the landing/login pages shown before authentication, and this
  // also carries the facility's payment details, so it's behind the web key.
  @Get()
  @UseGuards(PublicKeyGuard)
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
