import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configuredOrigins = process.env.WEB_URL?.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: configuredOrigins?.length ? configuredOrigins : process.env.NODE_ENV === 'production' ? false : true, credentials: true });
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
