import type { ReactNode } from "react";
import { SalesShell } from "@/components/sales-shell";

export default function SalesLayout({ children }: { children: ReactNode }) {
  return <SalesShell>{children}</SalesShell>;
}
