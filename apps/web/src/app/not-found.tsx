import Link from "next/link";

export default function NotFound() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#fffaf2", color: "#0d1d17" }}>
    <section style={{ maxWidth: 620, textAlign: "center" }}>
      <small style={{ letterSpacing: ".16em" }}>BISPO COFFEES · 404</small>
      <h1 style={{ fontSize: "clamp(3rem, 8vw, 6rem)", lineHeight: .95, margin: "18px 0" }}>Esta página não está na nossa seleção.</h1>
      <p style={{ lineHeight: 1.7, opacity: .72 }}>Volte para conhecer os cafés escolhidos por José e Suzi.</p>
      <Link href="/loja" style={{ display: "inline-flex", marginTop: 20, padding: "14px 22px", borderRadius: 999, background: "#0d1d17", color: "white", textDecoration: "none" }}>Ir para a loja →</Link>
    </section>
  </main>;
}
