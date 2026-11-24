"use client";

import { useMemo, useState } from "react";
import { Award, Coffee, Gift, Plus, Search, UserCheck } from "lucide-react";
import { formatBRL, getLoyaltyTier } from "@/lib/domain";
import type { CustomerProfileDto } from "@/types/erp";

interface CustomersSectionProps {
  customers: CustomerProfileDto[];
  onStartOrderForCustomer: (customerId: number) => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

const TIER_BADGES: Record<string, string> = {
  OURO: "bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:text-amber-300",
  PRATA: "bg-stone-500/15 text-stone-700 border border-stone-500/30 dark:text-stone-300",
  BRONZE: "bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30",
};

export function CustomersSection({
  customers,
  onStartOrderForCustomer,
  onRefresh,
  onError,
}: CustomersSectionProps) {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [favoriteItem, setFavoriteItem] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.favoriteItem ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, favoriteItem, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao cadastrar cliente.");
        return;
      }
      setName("");
      setPhone("");
      setEmail("");
      setFavoriteItem("");
      setNotes("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function adjustPoints(id: number, pointsDelta: number) {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pointsDelta }),
    });
    if (!res.ok) {
      const json = await res.json();
      onError(json.error ?? "Erro ao ajustar pontos.");
      return;
    }
    await onRefresh();
  }

  return (
    <div className="animate-fade-in grid gap-6 xl:grid-cols-12">
      {/* Cadastro de Cliente */}
      <section className="card-bistro p-5 xl:col-span-4">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="rounded-xl bg-[var(--accent-primary-soft)] p-2 text-[var(--accent-primary)]">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Clube do Café · Novo Cliente
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              A cada R$ 10 gastos = 1 ponto. 10 pts valem R$ 15 de desconto no PDV.
            </p>
          </div>
        </div>

        <form onSubmit={createCustomer} className="space-y-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            className="input-field rounded-xl"
          />
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp (ex: (11) 99999-8888)"
            className="input-field rounded-xl"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail (opcional)"
            className="input-field rounded-xl"
          />
          <input
            type="text"
            value={favoriteItem}
            onChange={(e) => setFavoriteItem(e.target.value)}
            placeholder="Pedido favorito (ex: Cappuccino + Croissant)"
            className="input-field rounded-xl"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferências do barista (ex: leite vegetal, sem açúcar)"
            className="input-field rounded-xl"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            Cadastrar no Clube
          </button>
        </form>
      </section>

      {/* Lista CRM */}
      <section className="card-bistro p-5 xl:col-span-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Base de Clientes &amp; Pontuação ({customers.length})
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Selecione um cliente para iniciar pedido no PDV ou{" "}
              <a
                href="/api/reports/export?scope=customers"
                className="font-bold text-[var(--accent-primary)] hover:underline"
              >
                exportar base CSV
              </a>
              .
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome ou telefone..."
              className="input-field rounded-xl pl-8"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((customer) => {
            const tier = getLoyaltyTier(customer.loyaltyPoints);
            return (
              <div
                key={customer.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[var(--text-primary)]">{customer.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_BADGES[tier]}`}
                        >
                          {tier}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num inline-flex items-center gap-1 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)] shadow-xs">
                        <Gift className="h-3.5 w-3.5" /> {customer.loyaltyPoints} pts
                      </span>
                    </div>
                  </div>

                  {customer.favoriteItem && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                      <Coffee className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                      {customer.favoriteItem}
                    </p>
                  )}
                  {customer.notes && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{customer.notes}</p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border-warm)] pt-2 text-[11px] text-[var(--text-secondary)]">
                    <span>Visitas: {customer.visitsCount}</span>
                    <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                      Total: {formatBRL(customer.totalSpent)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStartOrderForCustomer(customer.id)}
                    className="btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Vender no PDV
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustPoints(customer.id, 5)}
                    className="btn-secondary rounded-xl px-2.5 py-2 text-xs font-semibold"
                    title="Bonificar +5 pontos"
                  >
                    +5 pts
                  </button>
                  {customer.loyaltyPoints >= 10 && (
                    <button
                      type="button"
                      onClick={() => adjustPoints(customer.id, -10)}
                      className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
                      title="Resgatar 10 pts manualmente"
                    >
                      -10 pts
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
