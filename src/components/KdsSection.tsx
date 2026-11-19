"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChefHat, Clock, Flame, Volume2, VolumeX } from "lucide-react";
import { channelLabel } from "@/lib/domain";
import type { OrderDto } from "@/types/erp";

interface KdsSectionProps {
  orders: OrderDto[];
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

const STATIONS = [
  { id: "ALL", label: "Todas Estações" },
  { id: "COZINHA", label: "Cozinha" },
  { id: "FORNO", label: "Forno Padaria" },
  { id: "CONFEITARIA", label: "Confeitaria" },
  { id: "BAR", label: "Cafeteria / Bar" },
];

const NEXT_STAGE: Record<
  string,
  { next: string; label: string; color: string }
> = {
  PENDENTE: {
    next: "PREPARANDO",
    label: "Iniciar",
    color: "bg-amber-600 text-white hover:bg-amber-700",
  },
  PREPARANDO: {
    next: "PRONTO",
    label: "Pronto",
    color: "bg-[#15803d] text-white hover:bg-[#22523d]",
  },
  PRONTO: {
    next: "ENTREGUE",
    label: "Entregar",
    color: "bg-[#0f172a] text-white hover:bg-black",
  },
};

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio playback optional
  }
}

export function KdsSection({ orders, onRefresh, onError }: KdsSectionProps) {
  const [station, setStation] = useState("ALL");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const prevTicketCountRef = useRef<number | null>(null);

  const activeTickets = useMemo(() => {
    return orders
      .filter((o) => !["PAGO", "CANCELADO"].includes(o.status))
      .map((order) => ({
        ...order,
        visibleItems: order.items.filter(
          (item) =>
            item.itemStatus !== "ENTREGUE" &&
            (station === "ALL" || item.prepStation === station),
        ),
      }))
      .filter((o) => o.visibleItems.length > 0);
  }, [orders, station]);

  useEffect(() => {
    if (
      soundEnabled &&
      prevTicketCountRef.current !== null &&
      activeTickets.length > prevTicketCountRef.current
    ) {
      playChime();
    }
    prevTicketCountRef.current = activeTickets.length;
  }, [activeTickets.length, soundEnabled]);

  async function advanceItem(
    orderId: number,
    itemId: number,
    itemStatus: string,
  ) {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemStatus }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao atualizar item no KDS.");
        return;
      }
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function completeTicket(
    orderId: number,
    targetStatus: "PRONTO" | "ENTREGUE",
  ) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/kds-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao concluir ticket no KDS.");
        return;
      }
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="card-bistro flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <ChefHat className="h-5 w-5 text-[#2563eb]" />
          <div>
            <h2 className="font-display text-xl font-bold text-[#0f172a]">
              KDS · Tela de Produção (Cozinha, Forno & Confeitaria)
            </h2>
            <p className="text-xs text-[#475569]">
              Pedidos de Balcão, Mesas e QR Code chegam aqui em tempo real com
              controle de SLA.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              soundEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            {soundEnabled ? "Som KDS ativo" : "Som KDS mudo"}
          </button>

          <div className="flex flex-wrap gap-1.5">
            {STATIONS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStation(st.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  station === st.id
                    ? "bg-[#2563eb] text-white"
                    : "bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTickets.length === 0 ? (
        <div className="card-bistro border-dashed p-10 text-center">
          <Check className="mx-auto h-8 w-8 text-[#15803d]" />
          <p className="mt-2 font-semibold text-[#0f172a]">
            Nenhum item pendente nesta estação!
          </p>
          <p className="text-xs text-[#475569]">
            Novos pedidos do PDV, Mesas ou QR Code aparecerão aqui
            automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {activeTickets.map((ticket) => {
            const elapsedMin = Math.max(
              1,
              Math.floor(
                (Date.now() - new Date(ticket.createdAt).getTime()) / 60000,
              ),
            );
            const allReady = ticket.visibleItems.every(
              (i) => i.itemStatus === "PRONTO",
            );
            const slaStyle =
              elapsedMin >= 18
                ? "bg-red-100 text-red-800 animate-pulse"
                : elapsedMin >= 10
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800";

            return (
              <div
                key={ticket.id}
                className="card-bistro flex flex-col justify-between overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-sm font-bold text-[#0f172a]">
                          {ticket.code}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                          ticket.channel === "DELIVERY" || ticket.channel === "RETIRADA"
                            ? "bg-[#2563eb]"
                            : "bg-[#0f172a]"
                        }`}>
                          {ticket.table ? ticket.table.name : channelLabel(ticket.channel)}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569]">
                        {ticket.customerName ?? "Cliente"}
                        {ticket.deliveryNeighborhood ? ` · ${ticket.deliveryNeighborhood}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${slaStyle}`}
                    >
                      <Clock className="h-3.5 w-3.5" /> {elapsedMin} min
                    </span>
                  </div>

                  <div className="space-y-2.5 p-4">
                    {ticket.visibleItems.map((item) => {
                      const action = NEXT_STAGE[item.itemStatus];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#f1f5f9] bg-[#f8fafc]/70 p-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#2563eb]">
                                {item.prepStation}
                              </span>
                              <span className="truncate text-xs font-bold text-[#0f172a]">
                                {item.qty}× {item.productName}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-900">
                                <Flame className="h-3 w-3 shrink-0" />{" "}
                                {item.notes}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] font-semibold text-[#475569]">
                              Status: {item.itemStatus}
                            </p>
                          </div>

                          {action && (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() =>
                                advanceItem(ticket.id, item.id, action.next)
                              }
                              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${action.color}`}
                            >
                              {action.label}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[#f1f5f9] bg-[#f8fafc]/60 px-4 py-2.5">
                  <button
                    type="button"
                    disabled={busyId === ticket.id}
                    onClick={() =>
                      completeTicket(
                        ticket.id,
                        allReady ? "ENTREGUE" : "PRONTO",
                      )
                    }
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      allReady
                        ? "bg-[#0f172a] text-white hover:bg-black"
                        : "bg-[#15803d] text-white hover:bg-[#22523d]"
                    }`}
                  >
                    <CheckCheck className="h-4 w-4" />
                    {allReady
                      ? "Marcar Ticket Entregue"
                      : "Concluir Todos os Itens"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
