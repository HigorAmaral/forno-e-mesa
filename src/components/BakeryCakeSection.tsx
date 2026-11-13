"use client";

import { useState } from "react";
import { CakeSlice, Croissant, Flame, Plus } from "lucide-react";
import { calculateCakeBalanceDue, formatBRL } from "@/lib/domain";
import type { BakeryBatchDto, CakeOrderDto, ProductDto } from "@/types/erp";

interface BakeryCakeSectionProps {
  products: ProductDto[];
  batches: BakeryBatchDto[];
  cakeOrders: CakeOrderDto[];
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

const NEXT_BATCH_STATUS: Record<string, { next: string; label: string }> = {
  AGENDADA: { next: "NO_FORNO", label: "Colocar no Forno" },
  NO_FORNO: { next: "PRONTA", label: "Forno Pronto (+Estoque)" },
};

const NEXT_CAKE_STATUS: Record<string, { next: string; label: string }> = {
  ORCAMENTO: { next: "CONFIRMADA", label: "Confirmar" },
  CONFIRMADA: { next: "PRODUCAO", label: "Iniciar Produção" },
  PRODUCAO: { next: "PRONTA", label: "Marcar Pronta" },
  PRONTA: { next: "ENTREGUE", label: "Registrar Entrega" },
};

export function BakeryCakeSection({
  products,
  batches,
  cakeOrders,
  onRefresh,
  onError,
}: BakeryCakeSectionProps) {
  const bakeryProducts = products.filter(
    (p) => p.category.sector === "PADARIA" || p.category.sector === "CONFEITARIA",
  );

  const [batchProductId, setBatchProductId] = useState<number>(
    bakeryProducts[0]?.id ?? products[0]?.id ?? 1,
  );
  const [plannedQty, setPlannedQty] = useState("20");
  const [bakeTime, setBakeTime] = useState("17:00");
  const [batchNotes, setBatchNotes] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [title, setTitle] = useState("");
  const [weightKg, setWeightKg] = useState("2.0");
  const [flavor, setFlavor] = useState("Massa Branca / Baunilha");
  const [filling, setFilling] = useState("Ninho com Morangos");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [deliverySlot, setDeliverySlot] = useState("15:00");
  const [totalPrice, setTotalPrice] = useState("260");
  const [depositPaid, setDepositPaid] = useState("130");
  const [themeNotes, setThemeNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(batchProductId),
          plannedQty: Number(plannedQty) || 10,
          bakeTime,
          notes: batchNotes,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao agendar fornada.");
        return;
      }
      setBatchNotes("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function advanceBatch(id: number, status: string) {
    const res = await fetch(`/api/batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao atualizar fornada.");
      return;
    }
    await onRefresh();
  }

  async function createCakeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          title,
          weightKg: Number(weightKg) || 1,
          flavor,
          filling,
          themeNotes,
          deliveryDate,
          deliverySlot,
          totalPrice: Number(totalPrice) || 150,
          depositPaid: Number(depositPaid) || 0,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao criar encomenda.");
        return;
      }
      setCustomerName("");
      setCustomerPhone("");
      setTitle("");
      setThemeNotes("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function advanceCake(id: number, status: string) {
    const res = await fetch(`/api/cakes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json();
      onError(j.error ?? "Erro ao atualizar encomenda.");
      return;
    }
    await onRefresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Padaria: Fornadas */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#e8ddd0] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <Croissant className="h-5 w-5 text-[#b5652a]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#211611]">
                Fornadas de Padaria & Vitrine
              </h2>
              <p className="text-xs text-[#6e594b]">
                Ao finalizar uma fornada, o estoque do produto sobe automaticamente no PDV.
              </p>
            </div>
          </div>

          <form onSubmit={createBatch} className="grid gap-2.5 sm:grid-cols-4">
            <select
              value={batchProductId}
              onChange={(e) => setBatchProductId(Number(e.target.value))}
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs font-medium sm:col-span-2"
            >
              {bakeryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="1"
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
              placeholder="Qtd"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <input
              type="time"
              value={bakeTime}
              onChange={(e) => setBakeTime(e.target.value)}
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="Observação da fornada (opcional)"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs sm:col-span-3"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#b5652a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#8c4517]"
            >
              <Plus className="h-3.5 w-3.5" /> Agendar
            </button>
          </form>

          <div className="mt-4 space-y-2.5">
            {batches.map((batch) => {
              const next = NEXT_BATCH_STATUS[batch.status];
              return (
                <div
                  key={batch.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f2ebe1] bg-[#fbf8f3] p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num rounded bg-white px-2 py-0.5 text-xs font-bold text-[#211611]">
                        {batch.bakeTime}
                      </span>
                      <p className="text-sm font-bold text-[#211611]">
                        {batch.productName}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          batch.status === "PRONTA"
                            ? "bg-emerald-100 text-emerald-800"
                            : batch.status === "NO_FORNO"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6e594b]">
                      Previsto: {batch.plannedQty} · Produzido: {batch.producedQty}
                      {batch.notes ? ` · ${batch.notes}` : ""}
                    </p>
                  </div>
                  {next && (
                    <button
                      type="button"
                      onClick={() => advanceBatch(batch.id, next.next)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#211611] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                    >
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      {next.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Confeitaria: Encomendas Personalizadas */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#e8ddd0] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <CakeSlice className="h-5 w-5 text-[#b5652a]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#211611]">
                Encomendas de Confeitaria & Eventos
              </h2>
              <p className="text-xs text-[#6e594b]">
                Bolos sob medida, tortas festivas e kits com controle de sinal e saldo restante.
              </p>
            </div>
          </div>

          <form onSubmit={createCakeOrder} className="grid gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Cliente (ex: Juliana Mendes)"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="WhatsApp (ex: (11) 99999-0000)"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descrição (ex: Bolo Pistache & Frutas Vermelhas)"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs sm:col-span-2"
            />
            <input
              type="text"
              required
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              placeholder="Massa / Sabor"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={filling}
              onChange={(e) => setFilling(e.target.value)}
              placeholder="Recheio"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Peso (kg)"
                className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="time"
                value={deliverySlot}
                onChange={(e) => setDeliverySlot(e.target.value)}
                className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-2 py-2 text-xs"
              />
              <input
                type="number"
                min="1"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="Total R$"
                className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-2.5 py-2 text-xs"
              />
              <input
                type="number"
                min="0"
                value={depositPaid}
                onChange={(e) => setDepositPaid(e.target.value)}
                placeholder="Sinal R$"
                className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-2.5 py-2 text-xs"
              />
            </div>
            <input
              type="text"
              value={themeNotes}
              onChange={(e) => setThemeNotes(e.target.value)}
              placeholder="Decoração / Escrita no topo (opcional)"
              className="rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs sm:col-span-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#b5652a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#8c4517] sm:col-span-2"
            >
              <Plus className="h-4 w-4" /> Registrar Encomenda
            </button>
          </form>

          <div className="mt-4 space-y-2.5">
            {cakeOrders.map((cake) => {
              const balanceDue = calculateCakeBalanceDue(cake.totalPrice, cake.depositPaid);
              const next = NEXT_CAKE_STATUS[cake.status];
              return (
                <div
                  key={cake.id}
                  className="rounded-xl border border-[#f2ebe1] bg-[#fbf8f3] p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-[#b5652a]">
                          {cake.code}
                        </span>
                        <h3 className="text-sm font-bold text-[#211611]">
                          {cake.title} ({cake.weightKg}kg)
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#211611]">
                          {cake.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#6e594b]">
                        {cake.customerName} · {cake.customerPhone} · Entrega: {cake.deliveryDate} às {cake.deliverySlot}
                      </p>
                      <p className="mt-1 text-xs text-[#211611]">
                        Massa: {cake.flavor} | Recheio: {cake.filling}
                        {cake.themeNotes ? ` | Tema: ${cake.themeNotes}` : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono-num text-xs font-bold text-[#211611]">
                        Total: {formatBRL(cake.totalPrice)}
                      </p>
                      <p className="font-mono-num text-[11px] text-[#6e594b]">
                        Sinal: {formatBRL(cake.depositPaid)} · Saldo:{" "}
                        <span className={balanceDue > 0 ? "font-bold text-[#b5652a]" : "text-[#2d6a4f]"}>
                          {formatBRL(balanceDue)}
                        </span>
                      </p>
                      {next && (
                        <button
                          type="button"
                          onClick={() => advanceCake(cake.id, next.next)}
                          className="mt-2 rounded-lg bg-[#211611] px-3 py-1 text-[11px] font-semibold text-white hover:bg-black"
                        >
                          {next.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
