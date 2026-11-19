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
  OURO: "bg-amber-100 text-amber-900 border border-amber-300",
  PRATA: "bg-stone-100 text-stone-800 border border-stone-300",
  BRONZE: "bg-orange-50 text-[#c44c17] border border-orange-200",
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
          <div className="rounded-xl bg-[#f1f5f9] p-2 text-[#2563eb]">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0f172a]">
              Clube do Café · Novo Cliente
            </h2>
            <p className="text-xs text-[#475569]">
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
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs"
          />
          <input
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp (ex: (11) 99999-8888)"
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail (opcional)"
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={favoriteItem}
            onChange={(e) => setFavoriteItem(e.target.value)}
            placeholder="Pedido favorito (ex: Cappuccino + Croissant)"
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferências do barista (ex: leite vegetal, sem açúcar)"
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs"
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
            <h2 className="font-display text-lg font-bold text-[#0f172a]">
              Base de Clientes & Pontuação ({customers.length})
            </h2>
            <p className="text-xs text-[#475569]">
              Selecione um cliente para iniciar pedido no PDV já acumulando ou resgatando pontos.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#475569]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome ou telefone..."
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2 pr-3 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((customer) => {
            const tier = getLoyaltyTier(customer.loyaltyPoints);
            return (
              <div
                key={customer.id}
                className="flex flex-col justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#0f172a]">{customer.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_BADGES[tier]}`}
                        >
                          {tier}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#475569]">{customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-[#2563eb] shadow-xs">
                        <Gift className="h-3.5 w-3.5" /> {customer.loyaltyPoints} pts
                      </span>
                    </div>
                  </div>

                  {customer.favoriteItem && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[#0f172a]">
                      <Coffee className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                      {customer.favoriteItem}
                    </p>
                  )}
                  {customer.notes && (
                    <p className="mt-1 text-[11px] text-[#475569]">{customer.notes}</p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-2 text-[11px] text-[#475569]">
                    <span>Visitas: {customer.visitsCount}</span>
                    <span className="font-mono-num font-bold text-[#15803d]">
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
                    className="rounded-xl border border-[#e2e8f0] bg-white px-2.5 py-2 text-xs font-semibold text-[#0f172a] hover:bg-[#f1f5f9]"
                    title="Bonificar +5 pontos"
                  >
                    +5 pts
                  </button>
                  {customer.loyaltyPoints >= 10 && (
                    <button
                      type="button"
                      onClick={() => adjustPoints(customer.id, -10)}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
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
