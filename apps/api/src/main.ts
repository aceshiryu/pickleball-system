import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Take over body parsing so we can raise the limit. Several payloads carry
  // inline images as data: URLs — payment-method QRs and the brand logo on a
  // settings PATCH, and receipts on a booking — which blow past body-parser's
  // 100kb default and would otherwise 413 before validation ever runs.
  const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false });
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // helmet hardening, tuned for local dev + Swagger UI:
  // - hsts only in production (HSTS forces HTTPS and browsers — esp. Safari —
  //   cache it hard, which breaks plain-http localhost with a TLS error)
  // - relaxed CSP so Swagger UI's inline scripts/styles render
  // - drop `upgrade-insecure-requests` so localhost assets aren't forced to https
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      hsts: isProduction,
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [`'self'`, `'unsafe-inline'`],
          'style-src': [`'self'`, `'unsafe-inline'`, 'https:'],
          'img-src': [`'self'`, 'data:', 'https:'],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('pickleball API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: 'api-docs-json',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
  console.log(`Swagger on http://localhost:${port}/api-docs`);
}
bootstrap();
