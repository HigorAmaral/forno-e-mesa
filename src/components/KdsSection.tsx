"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChefHat,
  Clock,
  Flame,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { channelLabel, getKdsUrgencyLevel, minutesSince } from "@/lib/domain";
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
    color: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
  PRONTO: {
    next: "ENTREGUE",
    label: "Entregar",
    color: "bg-[var(--bg-shell)] text-[#FAF3E8] hover:opacity-90",
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
  const [fullscreenMode, setFullscreenMode] = useState(false);
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

  useEffect(() => {
    if (!fullscreenMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreenMode(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenMode]);

  function toggleFullscreen() {
    const next = !fullscreenMode;
    setFullscreenMode(next);
    try {
      if (next && document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen().catch(() => null);
      } else if (!next && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => null);
      }
    } catch {
      // Fallback CSS fullscreen still works
    }
  }

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
    <div
      className={`animate-fade-in space-y-5 ${
        fullscreenMode
          ? "fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-canvas)] p-4 sm:p-6"
          : ""
      }`}
    >
      <div className="card-bistro flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <ChefHat className="h-5 w-5 text-[var(--accent-primary)]" />
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
              KDS · Tela de Produção (Cozinha, Forno & Confeitaria)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Pedidos de Balcão, Mesas, QR Code e Delivery em tempo real com alerta de SLA.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            {fullscreenMode ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {fullscreenMode ? "Sair Tela Cheia" : "Modo TV / Tela Cheia"}
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              soundEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
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
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
          <Check className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 font-semibold text-[var(--text-primary)]">
            Nenhum item pendente nesta estação!
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Novos pedidos do PDV, Mesas, Delivery ou QR Code aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {activeTickets.map((ticket) => {
            const elapsedMin = Math.max(1, minutesSince(ticket.createdAt));
            const urgency = getKdsUrgencyLevel(ticket.createdAt);
            const allReady = ticket.visibleItems.every(
              (i) => i.itemStatus === "PRONTO",
            );
            const slaStyle =
              urgency === "urgent"
                ? "bg-red-100 text-red-800 animate-pulse"
                : urgency === "warning"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800";

            const cardBorder =
              urgency === "urgent"
                ? "border-red-400 ring-1 ring-red-400/30"
                : urgency === "warning"
                  ? "border-amber-400"
                  : "";

            return (
              <div
                key={ticket.id}
                className={`card-bistro flex flex-col justify-between overflow-hidden ${cardBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                          {ticket.code}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                            ticket.channel === "DELIVERY" || ticket.channel === "RETIRADA"
                              ? "bg-[var(--accent-primary)]"
                              : "bg-[var(--bg-shell)]"
                          }`}
                        >
                          {ticket.table ? ticket.table.name : channelLabel(ticket.channel)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-primary)]">
                                {item.prepStation}
                              </span>
                              <span className="truncate text-xs font-bold text-[var(--text-primary)]">
                                {item.qty}× {item.productName}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                <Flame className="h-3 w-3 shrink-0" />{" "}
                                {item.notes}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
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

                <div className="border-t border-[var(--border-warm)] bg-[var(--bg-canvas)] px-4 py-2.5">
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
                        ? "bg-[var(--bg-shell)] text-[#FAF3E8] hover:opacity-90"
                        : "bg-emerald-700 text-white hover:bg-emerald-800"
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
