import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController, DashboardController] })
export class AppModule {}
