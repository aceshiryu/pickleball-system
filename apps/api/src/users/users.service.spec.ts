import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repo = moduleRef.get(getRepositoryToken(User));
  });

  it('findByEmail delegates to repository', async () => {
    const fake = { id: 'u1', email: 'a@b.com' } as User;
    repo.findOne.mockResolvedValue(fake);

    const result = await service.findByEmail('a@b.com');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
    expect(result).toBe(fake);
  });

  it('create hashes password before save', async () => {
    repo.create.mockImplementation((dto) => dto as User);
    repo.save.mockImplementation(async (u) => u as User);

    const result = await service.create('a@b.com', 'plain');

    expect(repo.create).toHaveBeenCalled();
    const createArg = repo.create.mock.calls[0][0] as Partial<User>;
    expect(createArg.email).toBe('a@b.com');
    expect(createArg.passwordHash).not.toBe('plain');
    expect(createArg.passwordHash?.length).toBeGreaterThan(20);
    expect(result.email).toBe('a@b.com');
  });
});
