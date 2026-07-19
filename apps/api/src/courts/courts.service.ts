import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
  ) {}

  findAll(): Promise<Court[]> {
    return this.courtRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  create(dto: CreateCourtDto): Promise<Court> {
    const court = this.courtRepo.create(dto);
    return this.courtRepo.save(court);
  }

  async update(id: string, dto: UpdateCourtDto): Promise<Court> {
    await this.courtRepo.update(id, dto);
    const court = await this.courtRepo.findOne({ where: { id } });
    if (!court) {
      throw new NotFoundException('Court not found');
    }
    return court;
  }

  async toggleMaintenance(id: string): Promise<Court> {
    const court = await this.courtRepo.findOne({ where: { id } });
    if (!court) {
      throw new NotFoundException('Court not found');
    }
    court.status = court.status === 'active' ? 'maintenance' : 'active';
    return this.courtRepo.save(court);
  }
}
