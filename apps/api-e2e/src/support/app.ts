/* eslint-disable */
import 'reflect-metadata';
import './test-env';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GoogleVerifier } from '../../../api/src/auth/google-verifier';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../../api/src/app.module';

// Boot the real Nest app in-process, mirroring apps/api/src/main.ts
// (global 'api' prefix + the same ValidationPipe). No HTTP server is bound —
// supertest drives the app's handler directly.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Google ID tokens can't be minted in-process, so the verifier is swapped
    // for one that decodes the fake `stub:<sub>:<email>:<name>` token built by
    // googleToken() below. Only the signature check is stubbed — everything
    // downstream (role rules, upsert, JWT signing) runs for real.
    .overrideProvider(GoogleVerifier)
    .useValue({
      verify: async (idToken: string) => {
        const [tag, sub, email, name] = idToken.split(':');
        if (tag !== 'stub') throw new UnauthorizedException('Invalid token');
        return { sub, email: email.toLowerCase(), name };
      },
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  // Hard guarantee: the running app must be connected to the e2e database.
  // If ConfigModule ever resolved a different DB_NAME, abort instead of
  // touching dev data.
  const ds = app.get<DataSource>(getDataSourceToken());
  const connectedDb = (ds.options as { database?: string }).database;
  const expected = process.env.DB_NAME;
  if (connectedDb !== expected || !/e2e|test/i.test(String(connectedDb))) {
    await app.close();
    throw new Error(
      `E2E aborted: app connected to database "${connectedDb}", expected e2e database "${expected}". Refusing to run against the wrong database.`,
    );
  }

  return app;
}

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await http(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken;
}

/** Build the fake ID token understood by the stubbed GoogleVerifier. */
export const googleToken = (identity: {
  sub?: string;
  email?: string;
  name?: string;
}) =>
  [
    'stub',
    identity.sub ?? `google-${identity.email ?? 'jordan.r@email.com'}`,
    identity.email ?? 'jordan.r@email.com',
    identity.name ?? 'Jordan Reyes',
  ].join(':');

export async function customerLogin(
  app: INestApplication,
  identity?: { sub?: string; email?: string; name?: string },
): Promise<{ token: string; needsProfile: boolean; userId: string }> {
  const res = await http(app)
    .post('/api/auth/google')
    .send({ idToken: googleToken(identity ?? {}) })
    .expect(200);
  return {
    token: res.body.accessToken,
    needsProfile: res.body.needsProfile,
    userId: res.body.user.id,
  };
}
