import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { GoogleVerifier } from './google-verifier';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: GoogleVerifier,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    users = moduleRef.get(UsersService);
    jwt = moduleRef.get(JwtService);
  });

  describe('login', () => {
    it('throws when user not found', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(service.login('a@b.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when password is invalid', async () => {
      const hash = await bcrypt.hash('correct', 4);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
      } as never);

      await expect(service.login('a@b.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns access token on success', async () => {
      const hash = await bcrypt.hash('correct', 4);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
      } as never);
      jwt.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login('a@b.com', 'correct');
      // The signed-in user rides along with the token so the client doesn't
      // need a second /me round-trip to render the shell.
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toMatchObject({ id: 'u1', email: 'a@b.com' });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@b.com',
        role: undefined,
      });
    });
  });

  describe('register', () => {
    it('throws on existing email', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1' } as never);
      await expect(
        service.register('a@b.com', 'password'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user and returns token', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue({
        id: 'u2',
        email: 'a@b.com',
      } as never);
      jwt.signAsync.mockResolvedValue('new.token');

      const result = await service.register('a@b.com', 'password');
      expect(users.create).toHaveBeenCalledWith('a@b.com', 'password', {
        role: 'admin',
      });
      expect(result.accessToken).toBe('new.token');
      expect(result.user).toMatchObject({ id: 'u2', email: 'a@b.com' });
    });
  });
});
