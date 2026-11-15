import type { ReactNode } from "react";
import { ProductionFlowStrip } from "@/components/production-flow-strip";

export default function ProductionLayout({children}:{children:ReactNode}){
 return <><ProductionFlowStrip/>{children}</>;
}
