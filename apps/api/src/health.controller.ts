import { Controller, Get } from '@nestjs/common';
import { Public } from './auth.guard';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'bbos-api', scope: 'industry', timestamp: new Date().toISOString() };
  }
}
