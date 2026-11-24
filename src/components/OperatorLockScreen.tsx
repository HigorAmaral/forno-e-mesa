"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Clock,
  Delete,
  KeyRound,
  Lock,
  Mail,
  QrCode,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { CoffeeSteamEmblem } from "./CafeAtmosphere";

interface OperatorLockScreenProps {
  storeName?: string;
  slogan?: string;
  openingHours?: string;
  isDeliveryOpen?: boolean;
}

export function OperatorLockScreen({
  storeName = "Forno & Mesa",
  slogan = "Padaria Artesanal, Cafeteria & Bistrô",
  openingHours = "Ter–Dom · 07:00 às 22:00",
  isDeliveryOpen = true,
}: OperatorLockScreenProps) {
  const [authMode, setAuthMode] = useState<"PIN" | "CREDENTIALS">("PIN");
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [trackCode, setTrackCode] = useState("");
  const [trackToken, setTrackToken] = useState("");

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
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--bg-canvas)] p-4 text-[var(--text-primary)] sm:p-6">
      <div className="w-full max-w-2xl space-y-4">
        {/* Main Access Card */}
        <div className="card-bistro animate-cafe-rise overflow-hidden shadow-xl">
          <div className="cafe-hero-surface px-6 py-6 text-[#FAF3E8]">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <CoffeeSteamEmblem size="lg" />
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight text-white">
                    {storeName}
                  </h1>
                  <p className="text-xs text-[#E6CCB2]">{slogan}</p>
                </div>
              </div>
              <span
                className={`chip ${
                  isDeliveryOpen
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                    : "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30"
                }`}
              >
                <Clock className="h-3 w-3" />
                {isDeliveryOpen ? "Aberto para pedidos" : "Delivery pausado"}
              </span>
            </div>
            <p className="relative z-10 mt-3 text-[11px] text-[#E6CCB2]/85">{openingHours}</p>
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            {/* Easy Access Cards for Customers */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Acesso Rápido para Clientes
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/delivery"
                  style={{ "--stagger": 1 } as CSSProperties}
                  className="cafe-card-hover cafe-stagger group flex items-center justify-between rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">
                        Pedir Delivery / Retirada
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Cardápio completo e cupons
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/conta"
                  style={{ "--stagger": 2 } as CSSProperties}
                  className="cafe-card-hover cafe-stagger group flex items-center justify-between rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">
                        Clube Fidelidade & Conta
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Pontos, endereço salvo e pedidos
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Mesa QR hint + Order Tracker */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4 text-xs text-[var(--text-secondary)]">
                <div className="mb-1.5 flex items-center gap-2 font-bold text-[var(--text-primary)]">
                  <QrCode className="h-4 w-4 text-[var(--accent-primary)]" />
                  Está em uma mesa?
                </div>
                <p className="leading-relaxed">
                  Aponte a câmera do celular para o <strong>QR Code da mesa</strong>{" "}
                  para abrir o cardápio digital e acompanhar sua comanda em tempo real.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Search className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
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
                    <span className="inline-flex shrink-0 items-center rounded-lg border border-[var(--border-warm)] px-3 py-1.5 text-xs text-[var(--text-secondary)] opacity-60">
                      Ver
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Internal Team Access */}
            <div className="border-t border-[var(--border-warm)] pt-5">
              {!showStaffPanel ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Painel administrativo, PDV e KDS restritos à equipe.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStaffPanel(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
                  >
                    <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Sou da equipe interna (Entrar)
                  </button>
                </div>
              ) : (
                <div className="animate-scale-in space-y-4 rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        Autenticação da Equipe
                      </h2>
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
                          <KeyRound className="h-3 w-3" /> PIN Rápido
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
                          <Mail className="h-3 w-3" /> E-mail & Senha
                        </span>
                      </button>
                    </div>
                  </div>

                  {authMode === "PIN" ? (
                    <form onSubmit={handlePinSubmit} className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          placeholder="Digite seu PIN (ex: 2026)"
                          className="input-field font-mono-num text-center text-base tracking-[0.3em]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={busy || !pin.trim()}
                          className="btn-primary rounded-lg px-5 py-2 text-xs font-bold disabled:opacity-50"
                        >
                          {busy ? "Entrando..." : "Desbloquear"}
                        </button>
                      </div>

                      {/* Touch-friendly Numeric Keypad */}
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handlePinDigit(d)}
                            className="font-mono-num min-h-10 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
                          >
                            {d}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPin((p) => p.slice(0, -1))}
                          className="col-span-2 flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"
                        >
                          <Delete className="h-3.5 w-3.5" /> Apagar
                        </button>
                      </div>

                      <p className="text-[11px] text-[var(--text-secondary)]">
                        PINs padrão: Admin <strong>2026</strong> · Caixa <strong>1010</strong> · Garçom{" "}
                        <strong>2020</strong> · Cozinha <strong>3030</strong>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handleCredentialsSubmit} className="grid gap-3 sm:grid-cols-2">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Demo: <code>admin@fornoemesa.com</code> / <code>forno2026</code>
                        </p>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50"
                        >
                          {busy ? "Validando..." : "Entrar no ERP"}
                        </button>
                      </div>
                    </form>
                  )}

                  {error && (
                    <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
