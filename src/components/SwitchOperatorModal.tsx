"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, LogOut, Mail, UserCheck, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { OperatorSessionDto } from "@/types/erp";

interface SwitchOperatorModalProps {
  open: boolean;
  currentSession: OperatorSessionDto;
  onClose: () => void;
}

export function SwitchOperatorModal({
  open,
  currentSession,
  onClose,
}: SwitchOperatorModalProps) {
  const [mode, setMode] = useState<"PIN" | "CREDENTIALS">("PIN");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSwitch(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload =
        mode === "PIN"
          ? { pin: pin.trim() }
          : { email: email.trim(), password };
      const res = await fetch("/api/auth/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Credenciais inválidas.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleLockScreen() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/operator", { method: "DELETE" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Trocar operador ou bloquear painel"
      onClick={onClose}
    >
      <div
        className="card-bistro animate-scale-in w-full max-w-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[var(--accent-primary)]" />
            <div>
              <h3 className="font-display text-lg font-bold">Sessão do Operador</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Logado como <strong>{currentSession.name}</strong> (
                {ROLE_LABELS[currentSession.role]})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Fechar modal de operador"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
            Trocar usuário
          </span>
          <div className="segmented">
            <button
              type="button"
              data-active={mode === "PIN"}
              onClick={() => {
                setMode("PIN");
                setError(null);
              }}
            >
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> PIN
              </span>
            </button>
            <button
              type="button"
              data-active={mode === "CREDENTIALS"}
              onClick={() => {
                setMode("CREDENTIALS");
                setError(null);
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSwitch} className="space-y-3">
          {mode === "PIN" ? (
            <label className="field-label">
              PIN do Colaborador
              <input
                type="password"
                inputMode="numeric"
                required
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ex: 2026 (Admin), 1010 (Caixa), 2020 (Garçom), 3030 (Cozinha)"
                className="input-field font-mono-num"
              />
            </label>
          ) : (
            <>
              <label className="field-label">
                E-mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colaborador@fornoemesa.com"
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
            </>
          )}

          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleLockScreen}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              <LogOut className="h-3.5 w-3.5" />
              Bloquear / Sair
            </button>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {busy ? "Trocando..." : "Trocar Operador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
