"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  CircleUserRound,
  Coffee,
  Compass,
  HelpCircle,
  House,
  LogOut,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import styles from "../account.module.css";

type Account = {
  id: string;
  email: string;
  name: string;
  phone: string;
  taxId: string;
  preferences: {
    repurchaseIntervalDays?: number;
    defaultRhythmDays?: number;
  };
  sensoryProfile?: { name?: string; mood?: string } | null;
  marketingConsent: boolean;
};
type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone?: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
};
type Order = {
  id: string;
  code: string;
  status: string;
  items: Array<{ id?: string; name?: string; quantity?: number; grind?: string }>;
  recurrence?: {
    mode?: string;
    reminderDays?: number;
    rhythmDays?: number;
  } | null;
  totalCents: number;
  createdAt: string;
  latestEventTitle?: string | null;
  trackingCode?: string | null;
};
type Dashboard = { account: Account; addresses: Address[]; orders: Order[] };

const navigation = [
  { href: "#inicio", label: "Visão geral", icon: House },
  { href: "#pedidos", label: "Meus pedidos", icon: ShoppingBag },
  { href: "#recompra", label: "Recomprar", icon: RefreshCw },
  { href: "#enderecos", label: "Endereços", icon: MapPin },
  { href: "#perfil", label: "Dados pessoais", icon: CircleUserRound },
];
const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento confirmado",
  PREPARING: "Em preparo",
  INVOICED: "Nota emitida",
  SHIPPED: "A caminho",
  DELIVERED: "Entregue",
  PAYMENT_FAILED: "Pagamento não concluído",
  EXCEPTION: "Precisamos falar com você",
  CANCELLED: "Cancelado",
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0) / 100,
  );
const postalCode = (value: string) =>
  value?.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2");

const emptyAddress = {
  label: "Principal",
  recipientName: "",
  phone: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  isDefault: true,
};

export default function CustomerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [reordering, setReordering] = useState("");
  const [address, setAddress] = useState(emptyAddress);
  const [profile, setProfile] = useState({ name: "", phone: "", marketingConsent: false });

  async function load() {
    const response = await fetch("/api/storefront/customer/me", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/loja/conta");
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Não foi possível abrir sua conta.");
    setData(body);
    setProfile({
      name: body.account.name || "",
      phone: body.account.phone || "",
      marketingConsent: Boolean(body.account.marketingConsent),
    });
  }

  useEffect(() => {
    load()
      .catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível abrir sua conta."))
      .finally(() => setLoading(false));
    // A sessão é a única dependência desta leitura inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = data?.account.name.trim().split(/\s+/)[0] || "";
  const initials = useMemo(
    () =>
      (data?.account.name || "Minha Bispo")
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [data?.account.name],
  );
  const repurchaseInterval =
    data?.account.preferences?.repurchaseIntervalDays ??
    data?.account.preferences?.defaultRhythmDays;

  async function patchProfile(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/storefront/customer/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível salvar.");
      setData((current) => current && { ...current, account: body.account });
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await patchProfile(profile, "Seus dados foram atualizados.");
  }

  async function saveRepurchaseInterval(days: number) {
    await patchProfile(
      {
        preferences: {
          ...(data?.account.preferences || {}),
          repurchaseIntervalDays: days,
        },
      },
      `Intervalo de recompra salvo: ${days} dias.`,
    );
  }

  async function repeatOrder(orderId: string) {
    setReordering(orderId);
    setMessage("");
    try {
      const response = await fetch(
        `/api/storefront/orders/${encodeURIComponent(orderId)}/reorder`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Não foi possível recuperar esta escolha.");
      const current = JSON.parse(localStorage.getItem("bispo-cart-v2") || "[]");
      const merged = Array.isArray(current) ? [...current] : [];
      for (const item of body.items || []) {
        const index = merged.findIndex((saved) => saved.id === item.id);
        if (index >= 0) {
          merged[index] = {
            ...merged[index],
            ...item,
            quantity: Math.min(
              20,
              Number(merged[index].quantity || 0) + Number(item.quantity || 0),
            ),
          };
        } else {
          merged.push(item);
        }
      }
      localStorage.setItem("bispo-cart-v2", JSON.stringify(merged));
      localStorage.setItem("bispo-open-cart", "1");
      window.location.assign("/loja");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível recuperar esta escolha.",
      );
      setReordering("");
    }
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/storefront/customer/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(address),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível salvar o endereço.");
      await load();
      setAddress(emptyAddress);
      setShowAddressForm(false);
      setMessage("Endereço salvo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o endereço.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(id: string) {
    if (!window.confirm("Remover este endereço?")) return;
    const response = await fetch(`/api/storefront/customer/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.message || "Não foi possível remover o endereço.");
      return;
    }
    await load();
    setMessage("Endereço removido.");
  }

  async function logout() {
    await fetch("/api/storefront/customer/auth/logout", { method: "POST" });
    router.replace("/loja/conta");
    router.refresh();
  }

  if (loading)
    return <main className={styles.accountLoading}><Coffee /><p>Preparando a sua Bispo…</p></main>;
  if (!data)
    return <main className={styles.accountLoading}><p>{message || "Não foi possível abrir sua conta."}</p><Link href="/loja/conta">Tentar novamente</Link></main>;

  return (
    <main className={styles.dashboardPage}>
      <header className={styles.dashboardHeader}>
        <Link href="/loja" aria-label="Bispo Coffees — loja">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
        </Link>
        <div><span>MINHA BISPO</span><small>Seu café, acompanhado</small></div>
        <Link href="/loja">Ir para a loja <ArrowRight /></Link>
      </header>

      <div className={styles.dashboardShell}>
        <aside className={styles.accountNav}>
          <div className={styles.accountIdentity}><span>{initials}</span><div><small>SUA CONTA</small><strong>{firstName || "Minha Bispo"}</strong></div></div>
          <nav aria-label="Área do cliente">
            {navigation.map(({ href, label, icon: Icon }, index) => <a key={href} href={href} aria-current={index === 0 ? "page" : undefined}><Icon />{label}<ChevronRight /></a>)}
          </nav>
          <div className={styles.accountHelp}><HelpCircle /><strong>Precisa de ajuda?</strong><a href="mailto:pedidos@bispocoffees.com.br">Falar com a Bispo</a></div>
          <button className={styles.exit} type="button" onClick={logout}><LogOut /> Sair da conta</button>
        </aside>

        <div className={styles.dashboardContent}>
          {message && <p className={styles.dashboardMessage} role="status">{message}</p>}
          <section id="inicio" className={styles.welcome}>
            <div><span className={styles.eyebrow}>A SUA BISPO</span><h1>É bom ter você por aqui{firstName ? `, ${firstName}` : ""}.</h1><p>Este é o lugar para acompanhar as escolhas que continuam depois da compra.</p></div>
            <div className={styles.ritualMark} aria-hidden="true"><span>B</span><small>TRUE COFFEE</small></div>
          </section>

          <section className={styles.accountMetrics} aria-label="Resumo da conta">
            <article><span>Pedidos</span><strong>{data.orders.length}</strong><small>{data.orders.length === 1 ? "Escolha registrada" : "Escolhas registradas"}</small></article>
            <article><span>Perfil de café</span><strong>{data.account.sensoryProfile?.name || data.account.sensoryProfile?.mood || "Por descobrir"}</strong><Link href="/loja/descobrir">Fazer leitura →</Link></article>
            <article><span>Intervalo de recompra</span><strong>{repurchaseInterval ? `${repurchaseInterval} dias` : "Não definido"}</strong><a href="#recompra">Definir intervalo →</a></article>
          </section>

          <section id="pedidos" className={styles.ordersSection}>
            <header><div><small>MEUS PEDIDOS</small><h2>Da escolha à chegada.</h2></div><span>{data.orders.length} {data.orders.length === 1 ? "pedido conectado" : "pedidos conectados"}</span></header>
            {data.orders.length ? (
              <div className={styles.orderList}>
                {data.orders.map((order) => (
                  <article key={order.id}>
                    <div className={styles.orderNumber}><small>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</small><strong>{order.code}</strong></div>
                    <div className={styles.orderCoffee}><small>SUA ESCOLHA</small><strong>{order.items.map((item) => item.name).filter(Boolean).join(", ") || "Café Bispo"}</strong><span>{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} pacote(s)</span></div>
                    <div className={styles.orderStatus}><small>ETAPA ATUAL</small><strong>{order.latestEventTitle || statusLabel[order.status] || order.status}</strong>{order.trackingCode && <span>{order.trackingCode}</span>}</div>
                    <div className={styles.orderTotal}><small>TOTAL</small><strong>{money(order.totalCents)}</strong><div className={styles.orderActions}><button type="button" disabled={reordering === order.id} onClick={() => repeatOrder(order.id)}><RefreshCw /> {reordering === order.id ? "Recuperando…" : "Comprar novamente"}</button><Link href={`/loja/pedido/${order.id}`}>Acompanhar <ArrowRight /></Link></div></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyOrder}>
                <div className={styles.packageIllustration} aria-hidden="true"><PackageCheck /></div>
                <div><h3>Seus pedidos aparecerão aqui.</h3><p>Você verá pagamento, preparo, postagem, rastreamento e poderá repetir uma escolha em poucos passos.</p></div>
                <Link href="/loja#cafes">Escolher um café <ArrowRight /></Link>
              </div>
            )}
          </section>

          <section className={styles.relationshipGrid}>
            <article id="recompra" className={styles.rhythmCard}>
              <small>RECOMPRA</small><RefreshCw /><h2>Volte à sua escolha, com liberdade.</h2><p>Guarde o intervalo que combina com a sua rotina. Um novo pedido só acontece quando você escolhe e confirma.</p>
              <div>{[15, 30, 45].map((days) => <button className={repurchaseInterval === days ? styles.selectedRhythm : ""} disabled={saving} key={days} type="button" onClick={() => saveRepurchaseInterval(days)}>Em {days} dias</button>)}</div>
              <span>{repurchaseInterval ? `Intervalo de referência: ${repurchaseInterval} dias.` : "Nenhum intervalo definido."}</span>
            </article>
            <article className={styles.sensoryCard}>
              <div><small>SEU PERFIL SENSORIAL</small><Compass /><h2>A sua memória de sabor.</h2><p>Descubra se a sua xícara pede conforto, intensidade, frescor ou novas camadas.</p></div>
              <Link href="/loja/descobrir">Descobrir meu perfil <ArrowRight /></Link>
            </article>
          </section>

          <section className={styles.detailsGrid}>
            <article id="enderecos" className={styles.addressPanel}>
              <header><MapPin /><div><small>ENTREGA</small><h2>Endereços</h2></div></header>
              {data.addresses.length ? <div className={styles.addressList}>{data.addresses.map((item) => <section key={item.id}><div><strong>{item.label}{item.isDefault ? " · principal" : ""}</strong><span>{item.street}, {item.number}{item.complement ? ` · ${item.complement}` : ""}</span><span>{item.district} · {item.city}/{item.state} · {postalCode(item.postalCode)}</span></div><button type="button" aria-label={`Remover endereço ${item.label}`} onClick={() => removeAddress(item.id)}><Trash2 /></button></section>)}</div> : <p>Nenhum endereço salvo.</p>}
              <button type="button" onClick={() => { setAddress((current) => ({ ...current, recipientName: data.account.name, phone: data.account.phone })); setShowAddressForm((current) => !current); }}>{showAddressForm ? "Cancelar" : "Adicionar endereço"}</button>
              {showAddressForm && <form className={styles.addressForm} onSubmit={saveAddress}>
                <label>Nome do endereço<input value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} required /></label>
                <label>Destinatário<input value={address.recipientName} onChange={(e) => setAddress({ ...address, recipientName: e.target.value })} required /></label>
                <label>CEP<input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, "").slice(0, 8) })} inputMode="numeric" required /></label>
                <label>Rua<input value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required /></label>
                <label>Número<input value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} required /></label>
                <label>Complemento<input value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} /></label>
                <label>Bairro<input value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} required /></label>
                <label>Cidade<input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required /></label>
                <label>UF<input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })} required /></label>
                <label className={styles.checkLabel}><input type="checkbox" checked={address.isDefault} onChange={(e) => setAddress({ ...address, isDefault: e.target.checked })} /> Usar como principal</label>
                <button disabled={saving} type="submit">{saving ? "Salvando…" : "Salvar endereço"}</button>
              </form>}
            </article>
            <article id="perfil" className={styles.profilePanel}>
              <header><CircleUserRound /><div><small>CONTA</small><h2>Dados pessoais</h2></div></header>
              <form className={styles.profileForm} onSubmit={saveProfile}>
                <label>Nome<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></label>
                <label>E-mail<input value={data.account.email} readOnly /></label>
                <label>Telefone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} inputMode="tel" /></label>
                {data.account.taxId && <label>CPF<input value={`•••.•••.•••-${data.account.taxId.slice(-2)}`} readOnly /></label>}
                <label className={styles.checkLabel}><input type="checkbox" checked={profile.marketingConsent} onChange={(e) => setProfile({ ...profile, marketingConsent: e.target.checked })} /> Quero receber novidades e safras Bispo.</label>
                <button disabled={saving} type="submit">{saving ? "Salvando…" : "Salvar meus dados"}</button>
              </form>
            </article>
          </section>

          <footer className={styles.dashboardFooter}><div><Coffee /><span>Escolhido na origem. Cuidado até a sua xícara.</span></div><nav><Link href="/aviso-privacidade">Privacidade</Link><Link href="/loja/entrega-e-devolucoes">Atendimento</Link></nav></footer>
        </div>
      </div>
    </main>
  );
}
