import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

function normalizeOrigin(origin: string) {
  return origin
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function extractHostname(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.enableShutdownHooks();
  app.disable('etag');

  app.use((req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

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
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://evfleet-frontend-rgke.vercel.app',
    'https://evfleet-frontend.vercel.app',
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

      const incomingOrigin = normalizeOrigin(origin);

      if (allowedOrigins.has('*')) {
        callback(null, true);
        return;
      }

      const hostname = extractHostname(incomingOrigin);

      const isKnownHost =
        hostname.endsWith('.vercel.app') || hostname.endsWith('.railway.app');

      const matchesPattern = corsOriginPatterns.some((pattern) =>
        pattern.test(incomingOrigin),
      );

      const isAllowed =
        allowedOrigins.has(incomingOrigin) || matchesPattern || isKnownHost;

      callback(null, isAllowed);
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-company-id',
      'x-company-scope',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
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