import { Injectable } from "@nestjs/common";

export type StateRegistrationResult = {
  document: string;
  state: string;
  registrationStatus?: string;
  source: string;
  checkedAt: string;
};

export interface StateRegistrationProvider {
  lookup(document: string, state: string): Promise<StateRegistrationResult>;
}

@Injectable()
export class UnconfiguredStateRegistrationProvider implements StateRegistrationProvider {
  async lookup(
    document: string,
    state: string,
  ): Promise<StateRegistrationResult> {
    return {
      document,
      state,
      source: "not-configured",
      checkedAt: new Date().toISOString(),
    };
  }
}
