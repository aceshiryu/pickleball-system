import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CourtsModule } from './courts/courts.module';
import { BookingsModule } from './bookings/bookings.module';
import { OverridesModule } from './overrides/overrides.module';
import { SettingsModule } from './settings/settings.module';
import { CustomersModule } from './customers/customers.module';
import { StaffModule } from './staff/staff.module';
import { OnboardingGuard } from './common/guards/onboarding.guard';
import { StorageModule } from './storage/storage.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // dev (nx serve, cwd=workspace root) -> apps/api/.env;
      // deploy (cwd=dist, create-env writes .env there) -> .env
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmConfig(config),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL') ?? 60) * 1000,
          limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
        },
      ],
    }),
    StorageModule,
    ApiKeysModule,
    AuthModule,
    UsersModule,
    CourtsModule,
    BookingsModule,
    OverridesModule,
    SettingsModule,
    CustomersModule,
    StaffModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Refuses mutating requests until the facility finishes onboarding.
    // SettingsModule is imported above, so SettingsService resolves here.
    {
      provide: APP_GUARD,
      useClass: OnboardingGuard,
    },
  ],
})
export class AppModule {}
