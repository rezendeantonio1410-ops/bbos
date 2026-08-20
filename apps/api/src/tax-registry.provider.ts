export type TaxRegistryResult = {
  document: string;
  legalName?: string;
  tradeName?: string;
  registrationStatus?: string;
  statusDate?: string;
  address?: string;
  municipality?: string;
  state?: string;
  postalCode?: string;
  source: string;
  checkedAt: string;
};

export interface TaxRegistryProvider {
  lookup(document: string): Promise<TaxRegistryResult>;
}

/** No external provider is configured yet; this explicit implementation never fabricates a result. */
@Injectable()
export class UnconfiguredTaxRegistryProvider implements TaxRegistryProvider {
  async lookup(document: string): Promise<TaxRegistryResult> {
    return {
      document,
      source: "not-configured",
      checkedAt: new Date().toISOString(),
    };
  }
}
import { Injectable } from "@nestjs/common";
