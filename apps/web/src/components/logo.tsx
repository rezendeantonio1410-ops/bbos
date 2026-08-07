import Image from 'next/image';

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="inline-flex bg-[#fff] px-3 py-2" aria-label="Bispo Coffee"><Image src="/brand/logo/bispo-logo-official.jpg" alt="Bispo Coffee - True Coffee" width={860} height={240} priority className={`${compact ? 'w-20' : 'w-36'} h-auto object-contain`} /></div>;
}
