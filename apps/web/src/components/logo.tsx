import Image from 'next/image';

type LogoVariant = 'sidebar' | 'login' | 'compact';

export function Logo({ compact = false, variant }: { compact?: boolean; variant?: LogoVariant }) {
  const resolvedVariant = variant ?? (compact ? 'compact' : 'sidebar');
  const width = resolvedVariant === 'login' ? 'w-60 max-w-full' : resolvedVariant === 'compact' ? 'w-20' : 'w-44';
  const color = resolvedVariant === 'login' ? 'brightness-0 invert' : '';
  return <div className="inline-flex shrink-0 bg-transparent" aria-label="Bispo Coffees"><Image src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo Coffees - True Coffee" width={860} height={240} priority className={`${width} h-auto object-contain ${color}`} /></div>;
}
