/**
 * Bispo Coffees seal ("Trust the Bispo · True Coffee" around a B), drawn in
 * SVG with currentColor so it follows the surrounding brand color.
 */
export function BispoSeal({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <path id="bispo-seal-top" d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id="bispo-seal-bottom" d="M 102 60 A 42 42 0 0 1 18 60" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <text fill="currentColor" fontFamily="Montserrat, Inter, sans-serif" fontSize="9.5" letterSpacing="2.4">
        <textPath href="#bispo-seal-top" startOffset="50%" textAnchor="middle">TRUST THE BISPO TRUE COFFEE</textPath>
      </text>
      <text fill="currentColor" fontFamily="Montserrat, Inter, sans-serif" fontSize="9.5" letterSpacing="2.4">
        <textPath href="#bispo-seal-bottom" startOffset="50%" textAnchor="middle">TRUST THE BISPO TRUE COFFEE</textPath>
      </text>
      <circle cx="14" cy="60" r="1.8" fill="currentColor" />
      <circle cx="106" cy="60" r="1.8" fill="currentColor" />
      <text x="60" y="76" textAnchor="middle" fill="currentColor" fontFamily="Montserrat, Inter, sans-serif" fontWeight="600" fontSize="46">B</text>
    </svg>
  );
}
