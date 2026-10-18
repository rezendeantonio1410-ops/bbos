import { HumanPageHeader } from "@bbos/ui";
import { MobileAppSetup } from "@/components/mobile-app-setup";

export default function MobileApplicationPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <HumanPageHeader
        eyebrow="BBOS Mobile"
        title="Aplicativo para iPhone"
        description="Instalação privada para José e Suzi, com provas e atenções da operação."
      />
      <div className="mt-6">
        <MobileAppSetup />
      </div>
    </div>
  );
}
