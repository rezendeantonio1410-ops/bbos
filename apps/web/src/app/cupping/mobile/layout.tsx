import { CuppingBispoLogo } from "@/components/cupping-mobile";
export default function CuppingMobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_12%_4%,rgba(249,168,212,.10),transparent_30%),radial-gradient(circle_at_92%_88%,rgba(251,146,60,.08),transparent_32%),#fffaf4] text-slate-900">
      <div className="absolute right-3 top-[max(.75rem,env(safe-area-inset-top))] z-30">
        <CuppingBispoLogo />
      </div>
      {children}
    </div>
  );
}
