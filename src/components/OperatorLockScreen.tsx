"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Clock,
  Delete,
  KeyRound,
  Lock,
  Mail,
  Moon,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { CoffeeSteamEmblem } from "./CafeAtmosphere";

interface OperatorLockScreenProps {
  storeName?: string;
  slogan?: string;
  openingHours?: string;
  isDeliveryOpen?: boolean;
  defaultShowStaffPanel?: boolean;
  nextPath?: string;
  authNotice?: string | null;
}

const QUICK_PIN_ROLES = [
  { label: "Admin", pin: "2026", tone: "text-[var(--accent-primary)]" },
  { label: "Caixa", pin: "1010", tone: "text-emerald-700 dark:text-emerald-400" },
  { label: "Garçom", pin: "2020", tone: "text-sky-700 dark:text-sky-400" },
  { label: "Cozinha", pin: "3030", tone: "text-amber-700 dark:text-amber-400" },
] as const;

export function OperatorLockScreen({
  storeName = "Forno & Mesa",
  slogan = "Padaria Artesanal, Cafeteria & Bistrô",
  openingHours = "Ter–Dom · 07:00 às 22:00",
  isDeliveryOpen = true,
  defaultShowStaffPanel = false,
  nextPath,
  authNotice = null,
}: OperatorLockScreenProps) {
  const [authMode, setAuthMode] = useState<"PIN" | "CREDENTIALS">("PIN");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [trackCode, setTrackCode] = useState("");
  const [trackToken, setTrackToken] = useState("");

  const staffSectionRef = useRef<HTMLElement | null>(null);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      try {
        const domTheme = document.documentElement.dataset.theme;
        if (domTheme === "dark") setTheme("dark");
      } catch {
        // Ignore
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("forno_theme", next);
    } catch {
      // Ignore
    }
  }

  function focusStaffAccess() {
    staffSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => pinInputRef.current?.focus(), 220);
  }

  async function submitAuth(payload: { pin?: string; email?: string; password?: string }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Credenciais ou PIN inválidos.");
        return;
      }
      if (
        nextPath &&
        nextPath.startsWith("/") &&
        !nextPath.startsWith("//") &&
        nextPath !== "/login"
      ) {
        window.location.href = nextPath;
        return;
      }
      window.location.reload();
    } catch {
      setError("Erro de conexão ao validar acesso.");
    } finally {
      setBusy(false);
    }
  }

  function handlePinDigit(digit: string) {
    if (pin.length >= 8) return;
    setPin((prev) => prev + digit);
    setError(null);
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    void submitAuth({ pin: pin.trim() });
  }

  function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    void submitAuth({ email: email.trim(), password });
  }

  const canTrack = trackCode.trim().length >= 3 && trackToken.trim().length >= 4;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Clean Sticky Top Header */}
      <header className="cafe-topbar sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <CoffeeSteamEmblem size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display truncate text-base font-bold leading-tight text-[var(--text-primary)] sm:text-lg">
                  {storeName}
                </span>
                <span
                  className={`chip ${
                    isDeliveryOpen
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isDeliveryOpen ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {isDeliveryOpen ? "Aberto agora" : "Delivery pausado"}
                </span>
              </div>
              <p className="hidden truncate text-[11px] text-[var(--text-secondary)] sm:block">
                {openingHours}
              </p>
            </div>
          </div>

          <nav aria-label="Acesso rápido" className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/delivery"
              className="btn-secondary hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold sm:inline-flex"
            >
              <Truck className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Delivery
            </Link>
            <Link
              href="/conta"
              className="btn-secondary hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold sm:inline-flex"
            >
              <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Clube
            </Link>
            <button
              type="button"
              onClick={focusStaffAccess}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold lg:hidden"
            >
              <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Equipe
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn rounded-xl"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Tema Claro" : "Tema Escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 lg:py-10">
        {authNotice && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-900 dark:text-amber-200"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{authNotice}</span>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Customer Experience */}
          <section
            aria-label="Portal do Cliente"
            className={`space-y-4 lg:col-span-7 ${
              defaultShowStaffPanel ? "order-2 lg:order-1" : "order-1"
            }`}
          >
            {/* Hero Welcome Surface */}
            <div className="cafe-hero-surface animate-cafe-rise rounded-3xl p-6 text-[#F5F3EF] sm:p-8">
              <div className="relative z-10 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#FDE6D8]">
                    <Sparkles className="h-3.5 w-3.5 text-[#E8643C]" />
                    Fornadas quentinhas &amp; Cardápio Digital
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-stone-300">
                    <Clock className="h-3.5 w-3.5 text-[#E8643C]" />
                    {openingHours}
                  </span>
                </div>

                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                    {storeName}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm text-stone-300">{slogan}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/delivery"
                    className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
                  >
                    <Truck className="h-4 w-4" />
                    Pedir Delivery ou Retirada
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/conta"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <Award className="h-4 w-4 text-emerald-400" />
                    Minha Conta &amp; Pontos
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/delivery"
                style={{ "--stagger": 1 } as CSSProperties}
                className="card-bistro cafe-card-hover cafe-stagger group flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      Cardápio Delivery &amp; Retirada
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Pães, confeitaria, cafés e cupons
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--accent-primary)]" />
              </Link>

              <Link
                href="/conta"
                style={{ "--stagger": 2 } as CSSProperties}
                className="card-bistro cafe-card-hover cafe-stagger group flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      Clube Fidelidade &amp; Conta
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Saldo de pontos, endereço e pedidos
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-emerald-600" />
              </Link>
            </div>

            {/* Mesa QR Hint + Order Tracker */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card-bistro p-4 text-xs text-[var(--text-secondary)]">
                <div className="mb-1.5 flex items-center gap-2 font-bold text-[var(--text-primary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                    <QrCode className="h-4 w-4" />
                  </span>
                  Está em uma mesa?
                </div>
                <p className="leading-relaxed">
                  Aponte a câmera do celular para o <strong>QR Code da mesa</strong>{" "}
                  para abrir o cardápio digital, chamar o garçom e acompanhar sua
                  comanda em tempo real.
                </p>
              </div>

              <div className="card-bistro p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  Rastrear Pedido Delivery
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={trackCode}
                    onChange={(e) => setTrackCode(e.target.value.toUpperCase())}
                    placeholder="PED-0001"
                    className="input-field font-mono-num py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={trackToken}
                    onChange={(e) => setTrackToken(e.target.value)}
                    placeholder="Token"
                    className="input-field py-1.5 text-xs"
                  />
                  {canTrack ? (
                    <Link
                      href={`/delivery/acompanhar/${encodeURIComponent(trackCode.trim())}?t=${encodeURIComponent(trackToken.trim())}`}
                      className="btn-primary inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      Ver
                    </Link>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-lg border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-muted)] opacity-60">
                      Ver
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Staff & Admin Access */}
          <section
            ref={staffSectionRef}
            aria-label="Acesso da Equipe e Administração"
            className={`card-bistro animate-cafe-rise p-5 sm:p-6 lg:col-span-5 ${
              defaultShowStaffPanel ? "order-1 lg:order-2" : "order-2"
            }`}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-warm)] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Acesso da Equipe
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    PDV Balcão · Mesas · KDS · Gestão ERP
                  </p>
                </div>
              </div>

              <div className="segmented">
                <button
                  type="button"
                  data-active={authMode === "PIN"}
                  onClick={() => {
                    setAuthMode("PIN");
                    setError(null);
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3 w-3" /> PIN
                  </span>
                </button>
                <button
                  type="button"
                  data-active={authMode === "CREDENTIALS"}
                  onClick={() => {
                    setAuthMode("CREDENTIALS");
                    setError(null);
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> E-mail
                  </span>
                </button>
              </div>
            </div>

            {authMode === "PIN" ? (
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setError(null);
                    }}
                    placeholder="PIN (ex: 2026)"
                    className="input-field font-mono-num text-center text-base font-bold tracking-[0.3em]"
                    autoFocus={defaultShowStaffPanel}
                  />
                  <button
                    type="submit"
                    disabled={busy || !pin.trim()}
                    className="btn-primary shrink-0 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {busy ? "Entrando..." : "Desbloquear"}
                  </button>
                </div>

                {/* Touch-friendly 3x4 Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handlePinDigit(d)}
                      className="font-mono-num min-h-11 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-elevated)] text-base font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)] active:scale-95"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPin("");
                      setError(null);
                    }}
                    className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinDigit("0")}
                    className="font-mono-num min-h-11 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-elevated)] text-base font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)] active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  >
                    <Delete className="h-3.5 w-3.5" /> Apagar
                  </button>
                </div>

                {/* 1-Click Quick Role Chips */}
                <div className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Preenchimento rápido por perfil
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_PIN_ROLES.map((item) => (
                      <button
                        key={item.pin}
                        type="button"
                        onClick={() => {
                          setPin(item.pin);
                          setError(null);
                          pinInputRef.current?.focus();
                        }}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-left text-xs transition hover:border-[var(--accent-primary)]"
                      >
                        <span className={`font-semibold ${item.tone}`}>
                          {item.label}
                        </span>
                        <span className="font-mono-num text-[11px] font-bold text-[var(--text-secondary)]">
                          {item.pin}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                <label className="field-label">
                  E-mail Corporativo
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@fornoemesa.com"
                    className="input-field"
                  />
                </label>
                <label className="field-label">
                  Senha
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="input-field"
                  />
                </label>

                <div className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                  Acesso demo:{" "}
                  <code className="font-mono-num font-semibold text-[var(--text-primary)]">
                    admin@fornoemesa.com
                  </code>{" "}
                  /{" "}
                  <code className="font-mono-num font-semibold text-[var(--text-primary)]">
                    forno2026
                  </code>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary w-full rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50"
                >
                  {busy ? "Validando..." : "Entrar no ERP"}
                </button>
              </form>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
