"use client";

import { useState } from "react";
import { Coffee, Lock, QrCode, ShieldAlert } from "lucide-react";

export function OperatorLockScreen() {
  const [showPinForm, setShowPinForm] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "PIN incorreto.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#fbf8f3] p-5 text-[#211611]">
      <div className="w-full max-w-md rounded-3xl border border-[#e8ddd0] bg-white p-7 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#211611] to-[#4a2f20] text-[#d4943a] shadow-md">
          <Coffee className="h-7 w-7" />
        </div>

        <h1 className="font-display mt-4 text-2xl font-bold text-[#211611]">
          Forno & Mesa
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#b5652a]">
          Cardápio Digital para Clientes
        </p>

        <div className="mt-5 rounded-2xl border border-[#e8ddd0] bg-[#fbf8f3] p-4 text-left text-xs leading-relaxed text-[#6e594b]">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#211611]">
            <QrCode className="h-4 w-4 text-[#b5652a]" />
            Como acessar o cardápio pelo celular
          </div>
          <p>
            Aponte a câmera do seu celular para o <strong>QR Code da sua mesa</strong>{" "}
            para abrir apenas o cardápio digital e acompanhar sua comanda.
          </p>
          <p className="mt-2 flex items-center gap-1.5 font-medium text-[#8c4517]">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            O sistema administrativo e financeiro é restrito à equipe interna.
          </p>
        </div>

        <div className="mt-6 border-t border-[#f2ebe1] pt-4">
          {!showPinForm ? (
            <button
              type="button"
              onClick={() => setShowPinForm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e594b] hover:text-[#211611]"
            >
              <Lock className="h-3.5 w-3.5" /> Sou da equipe interna (Desbloquear)
            </button>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-2.5 text-left">
              <label className="block text-[11px] font-semibold uppercase text-[#6e594b]">
                PIN do Operador
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Digite o PIN..."
                  className="font-mono-num flex-1 rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-sm outline-none focus:border-[#b5652a]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? "Validando..." : "Entrar"}
                </button>
              </div>
              {error && (
                <p className="text-xs font-semibold text-red-700">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
