import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { GoogleVerifier } from './google-verifier';

export interface PublicUser {
  id: string;
  email: string;
  role: User['role'];
  name: string;
  phone: string | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly googleVerifier: GoogleVerifier,
  ) {}

  private sign(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Admin / staff sign-in (email + password).
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { accessToken: await this.sign(user), user: toPublicUser(user) };
  }

  // Admin accounts are seeded (db/seeds), and customers sign in with Google.
  // There is deliberately NO public registration — an /auth/register that
  // minted admin tokens for anyone was removed.

  // "Continue with Google": verify the ID token, then upsert the customer.
  async googleLogin(idToken: string) {
    const identity = await this.googleVerifier.verify(idToken);
    const user = await this.usersService.upsertGoogleCustomer(identity);
    if (!user) {
      // The address belongs to an admin/staff account — see
      // upsertGoogleCustomer. Deliberately vague: confirming that an address
      // is a console account would hand out a target list.
      throw new UnauthorizedException(
        'This account cannot sign in with Google. Use the admin login.',
      );
    }
    return {
      accessToken: await this.sign(user),
      user: toPublicUser(user),
      needsProfile: !user.phone,
    };
  }

  async completeProfile(userId: string, name: string, phone: string) {
    const user = await this.usersService.updateProfile(userId, name, phone);
    return toPublicUser(user);
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }
}
