import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
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
