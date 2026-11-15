"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ProfileAvatarField } from "@/components/profile-avatar-field";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  avatarUrl?: string | null;
};

const roleLabel: Record<string, string> = {
  ADMIN: "Sócio administrador",
  EXECUTIVE: "Executivo",
  FINANCE: "Financeiro",
  ACCOUNTANT: "Contabilidade",
  SALES: "Vendedor / Comercial",
  INDUSTRIAL: "Produção",
  MARKETPLACE_OPERATOR: "Operador de marketplace",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState("");
  const [resetting, setResetting] = useState(false);
  const [avatarTarget, setAvatarTarget] = useState<UserRow | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json().catch(() => []);
      if (!response.ok)
        throw new Error(body?.message ?? "Não foi possível carregar os usuários.");
      setUsers(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os usuários.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setSaving(true);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, role }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body?.message ?? "Não foi possível criar o acesso.");
      setDone(
        `${body.name} já pode acessar o BBOS com o e-mail ${body.email}.`,
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar o acesso.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPasswordReset = (user: UserRow) => {
    setResetTarget(user);
    setResetPassword("");
    setResetError("");
    setResetDone("");
  };

  const resetUserPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    setResetError("");
    setResetDone("");
    try {
      const response = await fetch(`/api/admin/users/${resetTarget.id}/password`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: resetPassword }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body?.message ?? "Não foi possível redefinir a senha.");
      setResetDone(
        `Senha de ${body.name} redefinida. As sessões anteriores foram encerradas.`,
      );
      setResetPassword("");
    } catch (caught) {
      setResetError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível redefinir a senha.",
      );
    } finally {
      setResetting(false);
    }
  };

  const openAvatar = (user: UserRow) => {
    setAvatarTarget(user);
    setAvatarPreview(null);
    setAvatarError("");
  };

  const selectAvatar = (file: File | null) => {
    setAvatarError("");
    setAvatarPreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null;
      if (!value || value.length > 3_000_000) {
        setAvatarError("A imagem é muito grande. Use JPG, PNG ou WebP de até 2 MB.");
        return;
      }
      setAvatarPreview(value);
    };
    reader.readAsDataURL(file);
  };

  const saveAvatar = async () => {
    if (!avatarTarget || !avatarPreview) return;
    setAvatarSaving(true);
    setAvatarError("");
    try {
      const response = await fetch(`/api/admin/users/${avatarTarget.id}/avatar`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: avatarPreview }),
      });
      const body = (await response.json().catch(() => ({}))) as UserRow & {
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.message ?? "Não foi possível atualizar a foto.");
      setUsers((current) =>
        current.map((user) => (user.id === body.id ? { ...user, ...body } : user)),
      );
      setDone(`Foto oficial de ${body.name} atualizada no BBOS.`);
      setAvatarTarget(null);
      setAvatarPreview(null);
    } catch (caught) {
      setAvatarError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível atualizar a foto.",
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-700">
          Administração
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Usuários e Acessos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Cada pessoa entra com sua própria conta. O BBOS mantém ações, sessões e
          identidade separadas.
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-violet-50 p-3 text-violet-700">
              <Users size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Equipe com acesso</h2>
              <p className="text-xs text-stone-500">
                Mesmo negócio, identidades independentes.
              </p>
            </div>
          </div>
          {loading ? (
            <p className="mt-6 text-sm text-stone-500">Carregando acessos…</p>
          ) : (
            <div className="mt-5 divide-y">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-stone-100 text-sm font-bold">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-stone-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold">
                      {roleLabel[user.role] ?? user.role}
                    </span>
                    <p
                      className={`mt-1 text-[11px] ${
                        user.active ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </p>
                    <button
                      type="button"
                      onClick={() => openPasswordReset(user)}
                      className="mt-2 text-xs font-semibold text-violet-700 hover:text-violet-900"
                    >
                      Redefinir senha
                    </button>
                    <button
                      type="button"
                      onClick={() => openAvatar(user)}
                      className="mt-2 block text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Alterar foto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <UserPlus size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Novo acesso</h2>
              <p className="text-xs text-stone-500">Crie o login sem sair do BBOS.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <Label title="Nome">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </Label>
            <Label title="E-mail">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </Label>
            <Label title="Perfil">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="ADMIN">Sócio administrador (ADMIN)</option>
                <option value="EXECUTIVE">Executivo</option>
                <option value="FINANCE">Financeiro</option>
                <option value="ACCOUNTANT">Contabilidade (somente leitura)</option>
                <option value="SALES">Vendedor / Comercial</option>
                <option value="INDUSTRIAL">Produção</option>
                <option value="MARKETPLACE_OPERATOR">
                  Operador externo de marketplace
                </option>
              </select>
              {role === "SALES" && (
                <p className="mt-2 text-[11px] leading-5 text-blue-700">
                  Acesso a cadastro de clientes, atendimento, visitas e operação
                  comercial, sem permissão financeira ou administrativa.
                </p>
              )}
              {role === "ACCOUNTANT" && (
                <p className="mt-2 text-[11px] leading-5 text-violet-700">
                  Consulta financeira, fiscal, custos, clientes, pedidos e vendas.
                  Não altera pagamentos, notas, estoque, crédito ou cadastros.
                </p>
              )}
            </Label>
            <Label title="Senha temporária">
              <div className="relative">
                <KeyRound
                  size={15}
                  className="absolute left-3 top-3.5 text-stone-400"
                />
                <input
                  className="pl-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                />
              </div>
              <p className="mt-1 text-[11px] text-amber-700">
                Use no mínimo 12 caracteres, com maiúsculas, minúsculas e números.
                Nunca reutilize uma senha pessoal.
              </p>
            </Label>
          </div>
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {done && (
            <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 size={17} />
              <span>{done}</span>
            </div>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="mt-5 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Criando acesso…" : "Criar acesso"}
          </button>
          <div className="mt-4 flex gap-2 rounded-2xl bg-violet-50 p-3 text-xs leading-5 text-violet-900">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" />
            <p>
              Administradores têm o mesmo nível de gestão e veem os mesmos dados da
              empresa, mas cada ação permanece ligada ao usuário que a executou.
            </p>
          </div>
        </section>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-violet-700">
                  Acesso protegido
                </p>
                <h2 className="mt-1 text-xl font-semibold">Redefinir senha</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {resetTarget.name} · {resetTarget.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setResetTarget(null)}
                className="rounded-full border p-2 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5">
              <Label title="Nova senha temporária">
                <div className="relative">
                  <KeyRound
                    size={15}
                    className="absolute left-3 top-3.5 text-stone-400"
                  />
                  <input
                    className="pl-9"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                  />
                </div>
              </Label>
              <p className="mt-2 text-xs leading-5 text-amber-700">
                Mínimo de 12 caracteres, com maiúsculas, minúsculas e números. Ao
                salvar, todas as sessões anteriores desse usuário serão encerradas.
              </p>
            </div>
            {resetError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {resetError}
              </div>
            )}
            {resetDone && (
              <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={17} className="shrink-0" />
                <span>{resetDone}</span>
              </div>
            )}
            <button
              type="button"
              disabled={resetting || !resetPassword}
              onClick={() => void resetUserPassword()}
              className="mt-5 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {resetting ? "Redefinindo…" : "Salvar nova senha"}
            </button>
          </section>
        </div>
      )}

      {avatarTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-700">
                  Identidade oficial
                </p>
                <h2 className="mt-1 text-xl font-semibold">Foto do perfil</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {avatarTarget.name} · {avatarTarget.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setAvatarTarget(null)}
                className="rounded-full border p-2 text-stone-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6">
              <ProfileAvatarField
                name={avatarTarget.name}
                value={avatarPreview ?? avatarTarget.avatarUrl}
                onChange={selectAvatar}
              />
              <p className="mt-3 flex items-center gap-2 text-xs text-stone-400">
                <Camera size={14} /> JPG, PNG ou WebP · até 2 MB
              </p>
            </div>
            {avatarError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {avatarError}
              </div>
            )}
            <button
              type="button"
              disabled={avatarSaving || !avatarPreview}
              onClick={() => void saveAvatar()}
              className="mt-5 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {avatarSaving ? "Atualizando…" : "Confirmar foto"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Label({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      <span>{title}</span>
      <div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_input]:py-3 [&_input]:outline-none [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:px-3 [&_select]:py-3 [&_select]:outline-none">
        {children}
      </div>
    </label>
  );
}
