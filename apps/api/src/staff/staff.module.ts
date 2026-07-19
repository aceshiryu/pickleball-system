import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { StaffController } from './staff.controller';

@Module({
  imports: [UsersModule],
  controllers: [StaffController],
  providers: [RolesGuard],
})
export class StaffModule {}
