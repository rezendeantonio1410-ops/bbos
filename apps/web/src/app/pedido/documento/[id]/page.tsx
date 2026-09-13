import OrderDocumentV2 from "@/components/order-document-v2";
import { OrderDocumentPrintLogoFix } from "@/components/order-document-print-logo-fix";

export default function OrderDocumentPage() {
  return (
    <>
      <OrderDocumentPrintLogoFix />
      <OrderDocumentV2 />
    </>
  );
}
