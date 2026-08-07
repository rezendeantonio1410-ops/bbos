import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'bbos-api', scope: 'industry', timestamp: new Date().toISOString() };
  }
}
