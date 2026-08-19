import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { bootstrapAdminFromEnvironment } from './bootstrap-admin';
import { execFileSync } from 'node:child_process';

function prepareStagingMigrations() {
  if (process.env.NODE_ENV !== 'production' || process.env.BBOS_STAGING_REFERENCE_SEED !== 'true') return;
  // Render services can retain a dashboard Build/Start command from before
  // render.yaml changed. Running the same fail-fast preparation at startup
  // guarantees the running API never serves an unprepared schema.
  execFileSync('pnpm', ['db:migrate:deploy'], { stdio: 'inherit' });
}

function seedStagingReferences() {
  if (process.env.NODE_ENV !== 'production' || process.env.BBOS_STAGING_REFERENCE_SEED !== 'true') return;
  execFileSync('pnpm', ['db:seed:coffee-references'], { stdio: 'inherit' });
}

async function bootstrap() {
  prepareStagingMigrations();
  const bootstrapResult = await bootstrapAdminFromEnvironment();
  if (bootstrapResult) console.log(`BBOS admin bootstrap ${bootstrapResult.created ? "created" : "verified"} for configured account.`);
  seedStagingReferences();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configuredOrigins = process.env.WEB_URL?.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: configuredOrigins?.length ? configuredOrigins : process.env.NODE_ENV === 'production' ? false : true, credentials: true });
  const port = Number.parseInt(process.env.PORT ?? '', 10) || 3001;
  const host = process.env.HOST?.trim() || '0.0.0.0';
  await app.listen(port, host);
  console.log(`BBOS API listening on ${host}:${port}`);
}

void bootstrap().catch((error: unknown) => {
  console.error('BBOS API failed to start', error);
  process.exitCode = 1;
});
