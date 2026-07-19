import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../common/guards/roles.guard';
import { Override } from './override.entity';
import { OverridesController } from './overrides.controller';
import { OverridesService } from './overrides.service';

@Module({
  imports: [TypeOrmModule.forFeature([Override])],
  controllers: [OverridesController],
  providers: [OverridesService, RolesGuard],
  exports: [OverridesService],
})
export class OverridesModule {}
