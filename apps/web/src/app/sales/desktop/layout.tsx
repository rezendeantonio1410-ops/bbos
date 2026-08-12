import type { ReactNode } from "react";
import { SalesDesktopLayout } from "@/components/sales-desktop-layout";

export default function DesktopSalesLayout({ children }: { children: ReactNode }) {
  return <SalesDesktopLayout>{children}</SalesDesktopLayout>;
}
