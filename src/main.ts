import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

function normalizeOrigin(origin: string) {
  return origin
    .trim()
    .replace(/^['\"]+|['\"]+$/g, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  const uploadsPath = join(process.cwd(), 'uploads');

  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://evfleet-frontend-rgke.vercel.app',
    'https://evfleet-frontend-production.up.railway.app',
  ].map(normalizeOrigin);

  const allowedOrigins = new Set([...defaultOrigins, ...corsOrigins]);

  const corsOriginPatterns = (
    process.env.CORS_ORIGIN_PATTERNS ??
    '^https://.*\\.vercel\\.app$,^https://.*\\.railway\\.app$'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new RegExp(value, 'i');
      } catch {
        return null;
      }
    })
    .filter((value): value is RegExp => value !== null);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has('*')) {
        callback(null, true);
        return;
      }

      const incomingOrigin = normalizeOrigin(origin);
      const isKnownHost =
        incomingOrigin.endsWith('.vercel.app') ||
        incomingOrigin.endsWith('.railway.app');
      const matchesPattern = corsOriginPatterns.some((pattern) =>
        pattern.test(incomingOrigin),
      );
      callback(
        null,
        allowedOrigins.has(incomingOrigin) || matchesPattern || isKnownHost,
      );
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
}
bootstrap();
