import { Controller, Get } from '@nestjs/common';
import { Public } from './auth.guard';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: process.env.RENDER_SERVICE_NAME ?? 'bbos-api',
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? process.env.BBOS_RELEASE ?? 'local',
      scope: 'coffee-operating-system',
      timestamp: new Date().toISOString(),
    };
  }
}
