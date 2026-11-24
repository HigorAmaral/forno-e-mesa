"use client";

import { type CSSProperties, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ExternalLink,
  Home,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Phone,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";
import { channelLabel, formatBRL, getLoyaltyTier } from "@/lib/domain";
import type { DeliveryZoneDto } from "@/types/erp";
import { CoffeeSteamEmblem } from "./CafeAtmosphere";

interface CustomerSessionData {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  favoriteItem: string | null;
  loyaltyPoints: number;
  loyaltyTier: "BRONZE" | "PRATA" | "OURO";
  totalSpent: number;
  visitsCount: number;
  defaultAddress: string | null;
  defaultNeighborhood: string | null;
  defaultReference: string | null;
}

interface CustomerOrderRow {
  id: number;
  code: string;
  channel: string;
  status: string;
  deliveryStatus: string | null;
  total: number;
  trackingToken: string | null;
  createdAt: string;
  items: Array<{ id: number; productName: string; qty: number }>;
}

export function CustomerPortalClient({
  zones,
  storeName,
}: {
  zones: DeliveryZoneDto[];
  storeName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerSessionData | null>(null);
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  // Login / Register state
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Profile edit state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFav, setEditFav] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNeighborhood, setEditNeighborhood] = useState("");
  const [editReference, setEditReference] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.authenticated && json.customer) {
        setCustomer(json.customer);
        setOrders(json.orders ?? []);
        setEditName(json.customer.name ?? "");
        setEditEmail(json.customer.email ?? "");
        setEditFav(json.customer.favoriteItem ?? "");
        setEditAddress(json.customer.defaultAddress ?? "");
        setEditNeighborhood(json.customer.defaultNeighborhood ?? "");
        setEditReference(json.customer.defaultReference ?? "");
      } else {
        setCustomer(null);
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/customer", { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json) return;
        if (json.authenticated && json.customer) {
          setCustomer(json.customer);
          setOrders(json.orders ?? []);
          setEditName(json.customer.name ?? "");
          setEditEmail(json.customer.email ?? "");
          setEditFav(json.customer.favoriteItem ?? "");
          setEditAddress(json.customer.defaultAddress ?? "");
          setEditNeighborhood(json.customer.defaultNeighborhood ?? "");
          setEditReference(json.customer.defaultReference ?? "");
        } else {
          setCustomer(null);
          setOrders([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/auth/customer", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.authenticated && json.customer) {
          setCustomer(json.customer);
          setOrders(json.orders ?? []);
        }
      } catch {
        // Silent polling error
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [customer]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const payload =
        tab === "login"
          ? { action: "login", phone: phone.trim(), pin: pin.trim() }
          : {
              action: "register",
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim() || undefined,
              pin: pin.trim(),
            };
      const res = await fetch("/api/auth/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error ?? "Erro na autenticação." });
        return;
      }
      await loadAccount();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/customer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          favoriteItem: editFav.trim(),
          defaultAddress: editAddress.trim(),
          defaultNeighborhood: editNeighborhood.trim(),
          defaultReference: editReference.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: "err", text: json.error ?? "Erro ao atualizar dados." });
        return;
      }
      setCustomer(json.customer);
      setFeedback({ type: "ok", text: "Dados e endereço padrão salvos!" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/customer", { method: "DELETE" });
    setCustomer(null);
    setOrders([]);
  }

  const tier = customer ? getLoyaltyTier(customer.loyaltyPoints) : "BRONZE";
  const nextGoal = tier === "BRONZE" ? 15 : tier === "PRATA" ? 40 : 40;
  const tierPct = customer
    ? Math.min(100, Math.round((customer.loyaltyPoints / nextGoal) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-12">
      <header className="cafe-sidebar text-white shadow-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-3 transition hover:opacity-90">
            <CoffeeSteamEmblem size="sm" />
            <div>
              <p className="font-display text-base font-bold text-white">{storeName}</p>
              <p className="text-[11px] text-stone-300">
                Minha Conta &amp; Clube de Fidelidade
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-stone-100 hover:bg-white/20"
            >
              <Home className="h-3.5 w-3.5" />
              Início
            </Link>
            <Link
              href="/delivery"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-dark)]"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Delivery
            </Link>
            {customer && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {loading ? (
          <div className="card-bistro p-10 text-center text-sm text-[var(--text-secondary)]">
            Carregando sua conta...
          </div>
        ) : !customer ? (
          <div className="animate-cafe-rise mx-auto max-w-md space-y-4">
            <div className="card-bistro overflow-hidden shadow-xl">
              <div className="cafe-hero-surface px-6 py-5 text-[#F5F3EF]">
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                      <Sparkles className="h-3 w-3 text-[#E8643C]" />
                      Clube de Pontos
                    </span>
                    <h1 className="font-display mt-2 text-xl font-bold text-white">
                      Clube {storeName}
                    </h1>
                    <p className="mt-0.5 text-xs text-stone-300">
                      Acumule pontos a cada R$ 10 e resgate R$ 15 OFF no delivery.
                    </p>
                  </div>
                  <CoffeeSteamEmblem size="md" />
                </div>
              </div>

              <div className="p-6">
              <div className="segmented mb-5 w-full">
                <button
                  type="button"
                  className="flex-1"
                  data-active={tab === "login"}
                  onClick={() => {
                    setTab("login");
                    setFeedback(null);
                  }}
                >
                  Já tenho conta
                </button>
                <button
                  type="button"
                  className="flex-1"
                  data-active={tab === "register"}
                  onClick={() => {
                    setTab("register");
                    setFeedback(null);
                  }}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {tab === "register" && (
                  <label className="field-label">
                    Seu nome completo *
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Maria Clara"
                      className="input-field"
                    />
                  </label>
                )}

                <label className="field-label">
                  Telefone / WhatsApp *
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 98812-3401"
                      className="input-field pl-9"
                    />
                  </div>
                </label>

                {tab === "register" && (
                  <label className="field-label">
                    E-mail (opcional)
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="maria@email.com"
                      className="input-field"
                    />
                  </label>
                )}

                <label className="field-label">
                  PIN de Acesso (4+ dígitos) *
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      minLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Ex: 1234"
                      className="input-field font-mono-num pl-9"
                    />
                  </div>
                </label>

                {feedback && (
                  <p
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      feedback.type === "err"
                        ? "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200"
                        : "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary w-full rounded-xl py-2.5 text-xs font-bold disabled:opacity-50"
                >
                  {busy
                    ? "Processando..."
                    : tab === "login"
                      ? "Entrar na Minha Conta"
                      : "Cadastrar e Participar"}
                </button>

                <p className="pt-1 text-center text-[11px] text-[var(--text-secondary)]">
                  Demo cliente: <code>(11) 98812-3401</code> · PIN <code>1234</code>
                </p>
              </form>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao início
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Loyalty Hero */}
            <section className="cafe-hero-surface animate-cafe-rise rounded-2xl p-6 text-white shadow-xl">
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span
                    className={`cafe-shimmer inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                      tier === "OURO"
                        ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40"
                        : tier === "PRATA"
                          ? "bg-stone-200/20 text-stone-100 ring-1 ring-stone-200/35"
                          : "bg-[#E8643C]/20 text-[#FDE6D8] ring-1 ring-[#E8643C]/40"
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" />
                    NÍVEL {tier}
                  </span>
                  <h1 className="font-display mt-3 text-2xl font-bold">
                    Olá, {customer.name}!
                  </h1>
                  <p className="text-xs text-stone-300">
                    {customer.phone} · {customer.visitsCount} pedidos realizados ·{" "}
                    {formatBRL(customer.totalSpent)} acumulados
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-right backdrop-blur-xs">
                  <p className="text-[11px] text-stone-300">Saldo de Pontos</p>
                  <p className="font-mono-num text-3xl font-bold text-amber-300">
                    {customer.loyaltyPoints} pts
                  </p>
                  <p className="text-[11px] text-emerald-300">
                    {customer.loyaltyPoints >= 10
                      ? "Resgate de R$ 15 OFF disponível no checkout!"
                      : `Faltam ${10 - customer.loyaltyPoints} pts para R$ 15 OFF`}
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-stone-300">
                  <span>Progresso de fidelidade</span>
                  <span>
                    {customer.loyaltyPoints} / {nextGoal} pts
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="cafe-shimmer h-full rounded-full bg-gradient-to-r from-[#E8643C] to-emerald-400 transition-all duration-700 ease-out"
                    style={{ width: `${tierPct}%` }}
                  />
                </div>
              </div>
            </section>

            {feedback && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                  feedback.type === "ok"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200"
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Saved Address & Preferences */}
              <form
                onSubmit={handleUpdateProfile}
                className="card-bistro space-y-3 p-5 lg:col-span-5"
              >
                <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                  <User className="h-4 w-4 text-[var(--accent-primary)]" />
                  Meus Dados & Endereço Padrão
                </h2>
                <label className="field-label">
                  Nome
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field"
                  />
                </label>
                <label className="field-label">
                  E-mail
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="input-field"
                  />
                </label>
                <label className="field-label">
                  Pedido Favorito
                  <input
                    type="text"
                    value={editFav}
                    onChange={(e) => setEditFav(e.target.value)}
                    placeholder="Ex: Cappuccino + Croissant"
                    className="input-field"
                  />
                </label>
                <label className="field-label">
                  Bairro / Região Padrão
                  <select
                    value={editNeighborhood}
                    onChange={(e) => setEditNeighborhood(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Selecione...</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Endereço de Entrega
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Rua, número e complemento"
                      className="input-field pl-9"
                    />
                  </div>
                </label>
                <label className="field-label">
                  Referência
                  <input
                    type="text"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="Ex: Portão branco"
                    className="input-field"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar Preferências
                </button>
              </form>

              {/* Orders History */}
              <section className="card-bistro p-5 lg:col-span-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">
                    Histórico de Pedidos ({orders.length})
                  </h2>
                  <Link
                    href="/delivery"
                    className="text-xs font-bold text-[var(--accent-primary)] hover:underline"
                  >
                    Fazer novo pedido →
                  </Link>
                </div>

                {orders.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--text-secondary)]">
                    Você ainda não possui pedidos vinculados a esta conta.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {orders.map((ord, idx) => (
                      <div
                        key={ord.id}
                        style={{ "--stagger": Math.min(idx, 10) } as CSSProperties}
                        className="cafe-card-hover cafe-stagger flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold">{ord.code}</span>
                            <span className="chip bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                              {channelLabel(ord.channel)}
                            </span>
                            <span className="chip bg-amber-500/15 text-amber-800 dark:text-amber-300">
                              {ord.deliveryStatus ?? ord.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                            {new Date(ord.createdAt).toLocaleString("pt-BR")} ·{" "}
                            {ord.items.map((i) => `${i.qty}× ${i.productName}`).join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono-num font-bold text-[var(--accent-primary)]">
                            {formatBRL(ord.total)}
                          </span>
                          {ord.trackingToken && (
                            <Link
                              href={`/delivery/acompanhar/${ord.code}?t=${ord.trackingToken}`}
                              className="icon-btn inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold"
                            >
                              Acompanhar <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-between gap-2 border-t border-[var(--border-warm)] px-4 pt-4 text-xs text-[var(--text-secondary)]">
        <span>{storeName} · Clube Fidelidade</span>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-semibold text-[var(--accent-primary)] hover:underline"
        >
          <Lock className="h-3 w-3" /> Área da Equipe
        </Link>
      </footer>
    </div>
  );
}
