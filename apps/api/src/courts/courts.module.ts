import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../common/guards/roles.guard';
import { Court } from './court.entity';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Court])],
  controllers: [CourtsController],
  providers: [CourtsService, RolesGuard],
  exports: [CourtsService],
})
export class CourtsModule {}
