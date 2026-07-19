import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Override } from './override.entity';
import { CreateOverrideDto } from './dto/create-override.dto';

@Injectable()
export class OverridesService {
  constructor(
    @InjectRepository(Override)
    private readonly repo: Repository<Override>,
  ) {}

  findAll(): Promise<Override[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  create(dto: CreateOverrideDto): Promise<Override> {
    const override = this.repo.create(dto);
    return this.repo.save(override);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    await this.repo.softDelete(id);
    return { deleted: true };
  }
}
