import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './settings.entity';
import { Court } from '../courts/court.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// Store hours de-duplicated and ascending so the grid reads predictably.
function normalizeHours(hours: number[]): number[] {
  return [...new Set(hours)].sort((a, b) => a - b);
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly repo: Repository<Settings>,
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
  ) {}

  // Loads the single branding row (id = 1), creating it with defaults if absent.
  private async ensure(): Promise<Settings> {
    let settings = await this.repo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = await this.repo.save(
        this.repo.create({
          id: 1,
          appName: 'AfterHours',
          primary: '#6B2B2B',
          secondary: '#6E7275',
        }),
      );
    }
    return settings;
  }

  get(): Promise<Settings> {
    return this.ensure();
  }

  async update(dto: UpdateSettingsDto): Promise<Settings> {
    const settings = await this.ensure();
    if (dto.appName !== undefined) settings.appName = dto.appName;
    if (dto.primary !== undefined) settings.primary = dto.primary;
    if (dto.secondary !== undefined) settings.secondary = dto.secondary;
    if (dto.fontFamily !== undefined) settings.fontFamily = dto.fontFamily;
    // '' or null both mean 'clear the logo'.
    if (dto.logoUrl !== undefined) settings.logoUrl = dto.logoUrl || null;

    // Validate the pair together: either side may be omitted, and a lone value
    // must still be consistent with the stored one.
    const openHour = dto.openHour ?? settings.openHour;
    const closeHour = dto.closeHour ?? settings.closeHour;
    if (closeHour <= openHour) {
      throw new BadRequestException(
        'Closing time must be later than opening time.',
      );
    }
    settings.openHour = openHour;
    settings.closeHour = closeHour;
    if (dto.peakHoursWeekday !== undefined) {
      settings.peakHoursWeekday = normalizeHours(dto.peakHoursWeekday);
    }
    if (dto.peakHoursWeekend !== undefined) {
      settings.peakHoursWeekend = normalizeHours(dto.peakHoursWeekend);
    }
    return this.repo.save(settings);
  }

  async isOnboardingComplete(): Promise<boolean> {
    const s = await this.ensure();
    return !!s.onboardingCompletedAt;
  }

  // Finish onboarding. The prerequisites are re-checked here so the flag can't
  // be set on an unusable facility by calling the endpoint directly.
  async completeOnboarding(): Promise<Settings> {
    const settings = await this.ensure();
    if (settings.onboardingCompletedAt) return settings;

    const missing: string[] = [];
    if ((await this.courtRepo.count()) === 0) missing.push('at least one court');
    if (settings.paymentMethods.length === 0)
      missing.push('at least one payment method');
    if (settings.closeHour <= settings.openHour) missing.push('valid opening hours');
    if (missing.length) {
      throw new BadRequestException(
        `Finish setup first — still missing: ${missing.join(', ')}.`,
      );
    }
    settings.onboardingCompletedAt = new Date();
    return this.repo.save(settings);
  }

  // Bookable window: start hours run openHour..closeHour-1.
  async getOpeningHours(): Promise<{ openHour: number; closeHour: number }> {
    const s = await this.ensure();
    return { openHour: s.openHour, closeHour: s.closeHour };
  }

  // The facility's peak hours, for pricing unbooked slots.
  async getPeakSchedule(): Promise<{ weekday: number[]; weekend: number[] }> {
    const s = await this.ensure();
    return {
      weekday: s.peakHoursWeekday ?? [],
      weekend: s.peakHoursWeekend ?? [],
    };
  }
}
