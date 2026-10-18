import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { BlingOutboxService } from "./integrations/bling/bling-outbox.service";
import { CustomerNotificationService } from "./customer-notification.service";
import { FiscalInboundService } from "./fiscal-inbound.service";
import { MercadoLivreService } from "./integrations/mercado-livre/mercado-livre.service";
import { MobileNotificationService } from "./mobile-notification.service";

@Injectable()
export class IntegrationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly bling: BlingOutboxService,
    private readonly notifications: CustomerNotificationService,
    private readonly fiscalInbound: FiscalInboundService,
    private readonly mercadoLivre: MercadoLivreService,
    private readonly mobileNotifications: MobileNotificationService,
  ) {}

  onModuleInit() {
    if (process.env.BBOS_BACKGROUND_JOBS_ENABLED !== "true") return;
    this.logger.log("Processamento automático de integrações ativado.");
    this.timer = setInterval(() => void this.tick(), 3000);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    while (this.running)
      await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.bling.processNext();
      await this.notifications.processNext();
      await this.fiscalInbound.syncConfiguredCompanies();
      await this.mercadoLivre.syncConnectedCompanies();
      await this.mobileNotifications.processNext();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.running = false;
    }
  }
}
