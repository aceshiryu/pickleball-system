import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

// Readable one-time password for a new staff account. Excludes ambiguous
// characters (0/O, 1/l/I) so it survives being copied out and typed back in.
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PW_LENGTH = 12;

function generatePassword(): string {
  let out = '';
  for (let i = 0; i < PW_LENGTH; i++) {
    out += PW_ALPHABET[randomInt(PW_ALPHABET.length)];
  }
  return out;
}

function toStaff(u: User) {
  return { id: u.id, name: u.name, email: u.email, access: u.role };
}

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('staff')
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const staff = await this.usersService.listStaff();
    return staff.map(toStaff);
  }

  @Post()
  async create(@Body() dto: CreateStaffDto) {
    // Generated per account and returned in plaintext ONLY in this response —
    // it is persisted hashed, so this is the admin's one chance to copy it.
    // createOrRestore 409s on an active email and revives a removed one.
    const tempPassword = generatePassword();
    const user = await this.usersService.createOrRestore(
      dto.email,
      tempPassword,
      { role: dto.access, name: dto.name },
    );
    return { ...toStaff(user), tempPassword };
  }

  // Generate a replacement password for an existing account. Like creation, the
  // plaintext is returned only in this response — the old password stops working
  // immediately.
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Param('id') id: string) {
    const tempPassword = generatePassword();
    const user = await this.usersService.setPassword(id, tempPassword);
    return { ...toStaff(user), tempPassword };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    const user = await this.usersService.setRole(id, dto.access);
    return toStaff(user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { deleted: true };
  }
}
