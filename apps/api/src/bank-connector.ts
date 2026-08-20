import type { BankTransactionSource } from "@bbos/database";

export type BankConnectorAccount = {
  externalId: string;
  name: string;
  currency: string;
  country?: string;
};

export type BankConnectorTransaction = {
  externalId?: string;
  transactionDate: Date;
  description: string;
  amount: number;
  currency: string;
  direction: "CREDIT" | "DEBIT";
  reference?: string;
  counterparty?: string;
  source: BankTransactionSource;
};

/** Adapter boundary for future CSV, OFX, API and Open Banking connectors. */
export interface BankConnector {
  connect(): Promise<void>;
  syncAccounts(): Promise<BankConnectorAccount[]>;
  syncTransactions(accountExternalId: string, since?: Date): Promise<BankConnectorTransaction[]>;
  getBalance(accountExternalId: string): Promise<{ amount: number; currency: string }>;
  disconnect(): Promise<void>;
}
