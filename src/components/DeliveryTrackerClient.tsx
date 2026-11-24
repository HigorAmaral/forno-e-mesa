"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Star,
  Store,
  XCircle,
} from "lucide-react";
import {
  buildWhatsAppLink,
  DELIVERY_STATUS_LABELS,
  formatBRL,
  getDeliveryFlow,
  type DeliveryStatus,
} from "@/lib/domain";
import { CoffeeSteamEmblem } from "./CafeAtmosphere";

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
  scheduledFor?: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  review?: {
    id: number;
    rating: number;
    comment: string | null;
  } | null;
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
  storePhone = "(11) 99999-0000",
  storeName = "Forno & Mesa",
}: {
  initialOrder: TrackedOrderDto;
  token: string;
  storePhone?: string;
  storeName?: string;
}) {
  const [order, setOrder] = useState<TrackedOrderDto>(initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

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
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, order.code, token]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: order.code,
          token,
          rating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReviewError(json.error ?? "Erro ao enviar avaliação.");
        return;
      }
      setOrder((prev) => ({ ...prev, review: json.review }));
    } finally {
      setReviewBusy(false);
    }
  }

  const whatsappStoreUrl = buildWhatsAppLink(
    storePhone,
    `Olá ${storeName}! Gostaria de falar sobre o pedido ${order.code}.`,
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-12">
      <header className="cafe-sidebar text-white shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <CoffeeSteamEmblem size="sm" />
            <div>
              <p className="font-display text-base font-bold">{storeName}</p>
              <p className="text-[11px] text-stone-300">Acompanhamento em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {whatsappStoreUrl && (
              <a
                href={whatsappStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/30"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Ajuda
              </a>
            )}
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="card-bistro animate-cafe-rise p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="chip bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                {isPickup ? <Store className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
                {isPickup ? "Retirada no balcão" : "Entrega Delivery"}
              </span>
              <h1 className="font-display mt-2 text-2xl font-bold">
                Pedido <span className="font-mono-num text-[var(--accent-primary)]">{order.code}</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Olá, <strong>{order.customerName}</strong> ·{" "}
                {current === "CANCELADO"
                  ? "Pedido cancelado"
                  : current === "ENTREGUE"
                    ? "Pedido entregue! Bom apetite."
                    : order.scheduledFor
                      ? `Agendado para ${order.scheduledFor}`
                      : `Previsão estimada: ~${order.estimatedMinutes ?? 35} min`}
              </p>
            </div>

            <span
              className={`chip px-3 py-1.5 text-xs ${
                current === "CANCELADO"
                  ? "bg-red-500/15 text-red-800 dark:text-red-300"
                  : current === "ENTREGUE"
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              }`}
            >
              {DELIVERY_STATUS_LABELS[current]}
            </span>
          </div>

          {current !== "CANCELADO" && (
            <div className="mt-6 space-y-3">
              {/* Barra contínua de progresso */}
              <div className="relative h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="cafe-shimmer h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-emerald-600 transition-all duration-700 ease-out"
                  style={{
                    width: `${
                      currentIdx <= 0
                        ? 12
                        : Math.min(100, Math.round(((currentIdx + 1) / flow.length) * 100))
                    }%`,
                  }}
                />
              </div>

              <ol className="grid gap-3 sm:grid-cols-5">
                {flow.map((step, idx) => {
                  const Icon = STEP_ICONS[step];
                  const done = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <li
                      key={step}
                      style={{ "--stagger": idx } as CSSProperties}
                      className={`cafe-stagger flex items-center gap-2.5 rounded-2xl border p-3 transition-all duration-300 sm:flex-col sm:text-center ${
                        isCurrent
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] shadow-sm ring-2 ring-[var(--accent-primary)]/25"
                          : done
                            ? "border-emerald-500/35 bg-emerald-500/10 text-[var(--text-primary)]"
                            : "border-[var(--border-warm)] bg-[var(--bg-canvas)] opacity-60"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform ${
                          isCurrent
                            ? "animate-tracker-pulse animate-cafe-float bg-[var(--accent-primary)] text-white"
                            : done
                              ? "bg-emerald-700 text-white"
                              : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">{DELIVERY_STATUS_LABELS[step]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {order.courierName && !isPickup && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-orange-500/35 bg-orange-500/10 px-3.5 py-2.5 text-xs font-semibold text-orange-900 dark:text-orange-200">
              <Bike className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Entregador: <strong>{order.courierName}</strong>
            </div>
          )}

          {!isPickup && order.deliveryAddress && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--bg-canvas)] p-3 text-xs text-[var(--text-secondary)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Endereço de entrega
                </p>
                <p>
                  {order.deliveryAddress}
                  {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Review Card when Delivered */}
        {current === "ENTREGUE" && (
          <div className="card-bistro p-5">
            {order.review ? (
              <div className="space-y-1 text-xs">
                <p className="font-display text-base font-bold text-emerald-700">
                  Obrigado pela sua avaliação!
                </p>
                <p className="text-amber-500 text-base">
                  {"★".repeat(order.review.rating)}
                  {"☆".repeat(5 - order.review.rating)}
                </p>
                {order.review.comment && (
                  <p className="text-[var(--text-secondary)]">
                    &ldquo;{order.review.comment}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submitReview} className="space-y-3">
                <div>
                  <h2 className="font-display text-lg font-bold">
                    Como foi seu pedido?
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sua opinião ajuda nossa cozinha e equipe a melhorar sempre.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="rounded-xl p-1.5 transition duration-200 hover:scale-125 active:scale-95"
                      aria-label={`${n} estrelas`}
                    >
                      <Star
                        className={`h-7 w-7 transition-all duration-200 ${
                          n <= rating
                            ? "scale-105 fill-amber-500 text-amber-500 drop-shadow-xs"
                            : "text-[var(--border-warm)]"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Deixe um elogio ou sugestão (opcional)..."
                  className="input-field resize-none text-xs"
                />
                {reviewError && (
                  <p className="text-xs font-semibold text-red-600">{reviewError}</p>
                )}
                <button
                  type="submit"
                  disabled={reviewBusy}
                  className="btn-primary rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {reviewBusy ? "Enviando..." : "Enviar Avaliação"}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="card-bistro animate-cafe-rise p-5">
          <h2 className="font-display text-lg font-bold">Resumo dos itens</h2>
          <ul className="mt-3 divide-y divide-[var(--border-warm)] text-xs">
            {order.items.map((it, idx) => (
              <li
                key={it.id}
                style={{ "--stagger": Math.min(idx, 10) } as CSSProperties}
                className="cafe-stagger flex items-center justify-between py-2.5"
              >
                <div>
                  <span className="font-mono-num font-bold">{it.qty}×</span>{" "}
                  <span className="font-semibold">{it.productName}</span>
                  {it.notes && (
                    <p className="text-[11px] text-[var(--text-secondary)]">{it.notes}</p>
                  )}
                </div>
                <span className="font-mono-num font-bold">{formatBRL(it.totalPrice)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-[var(--border-warm)] pt-3 text-xs">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Subtotal</span>
              <span className="font-mono-num">{formatBRL(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Desconto</span>
                <span className="font-mono-num">-{formatBRL(order.discount)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Taxa de entrega</span>
                <span className="font-mono-num">{formatBRL(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Total ({order.paymentMethod ?? "A combinar"})</span>
              <span className="font-mono-num text-[var(--accent-primary)]">
                {formatBRL(order.total)}
              </span>
            </div>
            {order.changeFor && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Troco solicitado para {formatBRL(order.changeFor)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/delivery"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Fazer outro pedido
          </Link>
          <Link
            href="/conta"
            className="text-xs font-bold text-[var(--text-secondary)] hover:underline"
          >
            Ver minha conta fidelidade →
          </Link>
        </div>
      </main>
    </div>
  );
}
