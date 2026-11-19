"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  Coffee,
  MapPin,
  Package,
  RefreshCw,
  Store,
  XCircle,
} from "lucide-react";
import {
  DELIVERY_STATUS_LABELS,
  formatBRL,
  getDeliveryFlow,
  type DeliveryStatus,
} from "@/lib/domain";

export interface TrackedOrderDto {
  code: string;
  channel: string;
  status: string;
  deliveryStatus: string | null;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryNeighborhood: string | null;
  courierName: string | null;
  paymentMethod: string | null;
  changeFor: number | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  estimatedMinutes: number | null;
  createdAt: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  items: Array<{
    id: number;
    productName: string;
    qty: number;
    totalPrice: number;
    notes: string | null;
  }>;
}

const STEP_ICONS: Record<DeliveryStatus, typeof Clock> = {
  RECEBIDO: Clock,
  EM_PREPARO: ChefHat,
  PRONTO: Package,
  SAIU_ENTREGA: Bike,
  ENTREGUE: CheckCircle2,
  CANCELADO: XCircle,
};

export function DeliveryTrackerClient({
  initialOrder,
  token,
}: {
  initialOrder: TrackedOrderDto;
  token: string;
}) {
  const [order, setOrder] = useState<TrackedOrderDto>(initialOrder);
  const [refreshing, setRefreshing] = useState(false);

  const isPickup = order.channel === "RETIRADA";
  const current = (order.deliveryStatus ?? "RECEBIDO") as DeliveryStatus;
  const isFinished = current === "ENTREGUE" || current === "CANCELADO";
  const flow = getDeliveryFlow(isPickup);
  const currentIdx = flow.indexOf(current);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/delivery/track?code=${encodeURIComponent(order.code)}&t=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = await res.json();
        setOrder(json.order);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, order.code, token]);

  return (
    <div className="min-h-screen pb-12">
      <header className="cafe-sidebar text-white shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#C07F5A] to-[#C07F5A]">
              <Coffee className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-bold">Forno & Mesa</p>
              <p className="text-[11px] text-[#9ca3af]">Acompanhamento em tempo real</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="card-bistro p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="chip bg-[#E6CCB2] text-[#8C5A3C]">
                {isPickup ? <Store className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
                {isPickup ? "Retirada no balcão" : "Entrega Delivery"}
              </span>
              <h1 className="font-display mt-2 text-2xl font-bold text-[#3E2723]">
                Pedido <span className="font-mono-num text-[#C07F5A]">{order.code}</span>
              </h1>
              <p className="text-xs text-[#8C5A3C]">
                Olá, <strong>{order.customerName}</strong> ·{" "}
                {current === "CANCELADO"
                  ? "Pedido cancelado"
                  : current === "ENTREGUE"
                    ? "Pedido entregue! Bom apetite."
                    : `Previsão estimada: ~${order.estimatedMinutes ?? 35} min`}
              </p>
            </div>

            <span
              className={`chip px-3 py-1.5 text-xs ${
                current === "CANCELADO"
                  ? "bg-red-100 text-red-900"
                  : current === "ENTREGUE"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-900"
              }`}
            >
              {DELIVERY_STATUS_LABELS[current]}
            </span>
          </div>

          {current !== "CANCELADO" && (
            <ol className="mt-6 grid gap-3 sm:grid-cols-5">
              {flow.map((step, idx) => {
                const Icon = STEP_ICONS[step];
                const done = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 sm:flex-col sm:text-center ${
                      isCurrent
                        ? "border-[#C07F5A] bg-amber-50/70 ring-2 ring-[#C07F5A]/20"
                        : done
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-[#E6CCB2] bg-[#FAF3E8] opacity-55"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isCurrent
                          ? "bg-[#C07F5A] text-white"
                          : done
                            ? "bg-[#15803d] text-white"
                            : "bg-[#E6CCB2] text-[#8C5A3C]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-[#3E2723]">
                      {DELIVERY_STATUS_LABELS[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {order.courierName && !isPickup && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-xs font-semibold text-orange-950">
              <Bike className="h-4 w-4 text-orange-700" />
              Entregador: <strong>{order.courierName}</strong>
            </div>
          )}

          {!isPickup && order.deliveryAddress && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#FAF3E8] p-3 text-xs text-[#8C5A3C]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C07F5A]" />
              <div>
                <p className="font-semibold text-[#3E2723]">Endereço de entrega</p>
                <p>
                  {order.deliveryAddress}
                  {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="card-bistro p-5">
          <h2 className="font-display text-lg font-bold">Resumo dos itens</h2>
          <ul className="mt-3 divide-y divide-[#E6CCB2] text-xs">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-mono-num font-bold">{it.qty}×</span>{" "}
                  <span className="font-semibold">{it.productName}</span>
                  {it.notes && <p className="text-[11px] text-[#8C5A3C]">{it.notes}</p>}
                </div>
                <span className="font-mono-num font-bold">{formatBRL(it.totalPrice)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-[#E6CCB2] pt-3 text-xs">
            <div className="flex justify-between text-[#8C5A3C]">
              <span>Subtotal</span>
              <span className="font-mono-num">{formatBRL(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-[#8C5A3C]">
                <span>Taxa de entrega</span>
                <span className="font-mono-num">{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Total ({order.paymentMethod ?? "A combinar"})</span>
              <span className="font-mono-num text-[#C07F5A]">{formatBRL(order.total)}</span>
            </div>
            {order.changeFor && (
              <p className="text-[11px] text-[#8C5A3C]">
                Troco solicitado para {formatBRL(order.changeFor)}
              </p>
            )}
          </div>
        </div>

        <Link
          href="/delivery"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C07F5A] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Fazer outro pedido
        </Link>
      </main>
    </div>
  );
}
