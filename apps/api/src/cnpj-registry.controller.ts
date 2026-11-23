import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { CnpjLookupError, CnpjRegistryClient } from "./cnpj-registry";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

@Controller("company-registry")
export class CnpjRegistryController {
  private readonly client = new CnpjRegistryClient();
  private readonly usage = new Map<string, { start: number; count: number }>();

  @Get("cnpj/:cnpj")
  async lookupCnpj(@Req() request: { user?: { id?: string } }, @Param("cnpj") cnpj: string) {
    const key = String(request.user?.id ?? "anonymous");
    const now = Date.now();
    const entry = this.usage.get(key);
    if (!entry || now - entry.start > WINDOW_MS) this.usage.set(key, { start: now, count: 1 });
    else if (++entry.count > MAX_PER_WINDOW)
      throw new HttpException("Muitas consultas de CNPJ. Aguarde um minuto.", 429);
    try {
      return await this.client.lookup(cnpj);
    } catch (error) {
      if (error instanceof CnpjLookupError) {
        if (error.code === "INVALID") throw new BadRequestException(error.message);
        if (error.code === "NOT_FOUND") throw new NotFoundException(error.message);
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }
}
