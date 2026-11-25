"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Power,
  Receipt,
  Store,
  Trash2,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  buildWhatsAppLink,
  DELIVERY_STATUS_LABELS,
  formatBRL,
  FREE_DELIVERY_ABOVE,
  minutesSince,
  nextDeliveryStatus,
  type DeliveryStatus,
} from "@/lib/domain";
import type { DeliveryZoneDto, OrderDto } from "@/types/erp";

interface DeliverySectionProps {
  orders: OrderDto[];
  zones: DeliveryZoneDto[];
  onOpenReceipt: (order: OrderDto) => void;
  onNewDeliveryOrder: () => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const COLUMNS: Array<{ id: DeliveryStatus; tone: string; icon: typeof Clock }> = [
  { id: "RECEBIDO", tone: "border-sky-300 bg-sky-50 text-sky-900", icon: Clock },
  { id: "EM_PREPARO", tone: "border-amber-300 bg-amber-50 text-amber-900", icon: Package },
  { id: "PRONTO", tone: "border-violet-300 bg-violet-50 text-violet-900", icon: CheckCircle2 },
  { id: "SAIU_ENTREGA", tone: "border-orange-300 bg-orange-50 text-orange-900", icon: Bike },
];

const NEXT_LABEL: Record<string, string> = {
  EM_PREPARO: "Iniciar preparo",
  PRONTO: "Marcar pronto",
  SAIU_ENTREGA: "Despachar",
  ENTREGUE: "Confirmar entrega",
};

export function DeliverySection({
  orders,
  zones,
  onOpenReceipt,
  onNewDeliveryOrder,
  onRefresh,
  onError,
  onSuccess,
}: DeliverySectionProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [courierDraft, setCourierDraft] = useState<Record<number, string>>({});
  const [view, setView] = useState<"board" | "history" | "zones">("board");
  const [now, setNow] = useState(() => new Date());
  const [zoneForm, setZoneForm] = useState({ name: "", fee: "6", etaMinutes: "35", minOrder: "25" });
  const [payDraft, setPayDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.channel === "DELIVERY" || o.channel === "RETIRADA"),
    [orders],
  );
  const active = deliveryOrders.filter(
    (o) => o.deliveryStatus && !["ENTREGUE", "CANCELADO"].includes(o.deliveryStatus),
  );
  const finished = deliveryOrders.filter(
    (o) => !o.deliveryStatus || ["ENTREGUE", "CANCELADO"].includes(o.deliveryStatus),
  );

  const couriers = useMemo(() => {
    const set = new Set<string>();
    deliveryOrders.forEach((o) => o.courierName && set.add(o.courierName));
    return [...set];
  }, [deliveryOrders]);

  const stats = useMemo(() => {
    const delivered = deliveryOrders.filter((o) => o.deliveryStatus === "ENTREGUE");
    const durations = delivered
      .filter((o) => o.deliveredAt)
      .map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60000);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const late = active.filter(
      (o) => o.estimatedMinutes && minutesSince(o.createdAt, now) > o.estimatedMinutes,
    ).length;
    const toCollect = active
      .filter((o) => o.status !== "PAGO")
      .reduce((s, o) => s + o.total, 0);
    const fees = deliveryOrders
      .filter((o) => o.status !== "CANCELADO")
      .reduce((s, o) => s + o.deliveryFee, 0);
    return { delivered: delivered.length, avg, late, toCollect, fees };
  }, [deliveryOrders, active, now]);

  async function patchDelivery(order: OrderDto, body: Record<string, unknown>, okMsg: string) {
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao atualizar entrega.");
        return;
      }
      onSuccess(okMsg);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvance(order: OrderDto) {
    const isPickup = order.channel === "RETIRADA";
    const next = nextDeliveryStatus(order.deliveryStatus, isPickup);
    if (!next) return;
    const courier = courierDraft[order.id]?.trim() || order.courierName || undefined;
    await patchDelivery(
      order,
      { advance: true, courierName: courier },
      `${order.code} → ${DELIVERY_STATUS_LABELS[next]}`,
    );
  }

  async function handleCancel(order: OrderDto) {
    if (!confirm(`Cancelar o pedido ${order.code}?`)) return;
    await patchDelivery(order, { deliveryStatus: "CANCELADO" }, `${order.code} cancelado.`);
  }

  async function handleCollect(order: OrderDto) {
    const method = payDraft[order.id] || order.paymentMethod || "PIX";
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao registrar pagamento.");
        return;
      }
      onSuccess(`Pagamento de ${order.code} registrado (${method}).`);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function zoneRequest(method: string, body?: unknown, query = "") {
    const res = await fetch(`/api/delivery/zones${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      onError(json.error ?? "Erro ao salvar região.");
      return false;
    }
    await onRefresh();
    return true;
  }

  async function handleCreateZone(e: React.FormEvent) {
    e.preventDefault();
    const ok = await zoneRequest("POST", {
      name: zoneForm.name.trim(),
      fee: Number(zoneForm.fee) || 0,
      etaMinutes: Number(zoneForm.etaMinutes) || 30,
      minOrder: Number(zoneForm.minOrder) || 0,
    });
    if (ok) {
      setZoneForm({ name: "", fee: "6", etaMinutes: "35", minOrder: "25" });
      onSuccess("Região de entrega cadastrada.");
    }
  }

  function copyTrackingLink(order: OrderDto) {
    if (!order.trackingToken) return;
    const url = `${window.location.origin}/delivery/acompanhar/${order.code}?t=${order.trackingToken}`;
    void navigator.clipboard?.writeText(url);
    onSuccess("Link de acompanhamento copiado!");
  }

  function whatsappFor(order: OrderDto) {
    const status = DELIVERY_STATUS_LABELS[(order.deliveryStatus ?? "RECEBIDO") as DeliveryStatus];
    const track =
      order.trackingToken && typeof window !== "undefined"
        ? `\nAcompanhe: ${window.location.origin}/delivery/acompanhar/${order.code}?t=${order.trackingToken}`
        : "";
    return buildWhatsAppLink(
      order.customerPhone,
      `Olá ${order.customerName ?? ""}! Seu pedido ${order.code} da Forno & Mesa está: ${status}. Total ${formatBRL(order.total)}.${track}`,
    );
  }

  function renderCard(order: OrderDto) {
    const isPickup = order.channel === "RETIRADA";
    const next = nextDeliveryStatus(order.deliveryStatus, isPickup);
    const elapsed = minutesSince(order.createdAt, now);
    const eta = order.estimatedMinutes ?? 40;
    const late = elapsed > eta;
    const pct = Math.min(100, Math.round((elapsed / Math.max(1, eta)) * 100));
    const wa = whatsappFor(order);
    const needsCourier = next === "SAIU_ENTREGA";

    return (
      <article
        key={order.id}
        className={`animate-fade-in rounded-2xl border bg-[var(--bg-surface)] p-3.5 text-xs shadow-sm ${
          late ? "border-red-500/50 ring-2 ring-red-500/20" : "border-[var(--border-warm)]"
        }`}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono-num text-sm font-bold">{order.code}</span>
              <span
                className={`chip ${
                  isPickup
                    ? "bg-teal-500/15 text-teal-800 dark:text-teal-300"
                    : "bg-orange-500/15 text-orange-800 dark:text-orange-300"
                }`}
              >
                {isPickup ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                {isPickup ? "Retirada" : "Delivery"}
              </span>
              <span
                className={`chip ${
                  order.status === "PAGO"
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {order.status === "PAGO" ? "Pago" : `A cobrar · ${order.paymentMethod ?? "—"}`}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-[var(--text-primary)]">{order.customerName}</p>
          </div>
          <span
            className={`font-mono-num shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${
              late
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}
            title="Tempo desde o pedido / previsão"
          >
            {elapsed}′ / {eta}′
          </span>
        </header>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div
            className={`h-full rounded-full transition-all ${
              late ? "bg-red-500" : "bg-gradient-to-r from-[var(--accent-primary)] to-emerald-600"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {!isPickup && (
          <p className="mt-2 flex items-start gap-1.5 text-[var(--text-secondary)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
            <span>
              {order.deliveryAddress}
              {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
              {order.deliveryReference ? (
                <em className="block text-[11px]">Ref: {order.deliveryReference}</em>
              ) : null}
            </span>
          </p>
        )}

        <ul className="mt-2 space-y-0.5 rounded-xl bg-[var(--bg-canvas)] p-2">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="truncate">
                <strong className="font-mono-num">{it.qty}×</strong> {it.productName}
                {it.notes ? <em className="text-[var(--text-muted)]"> · {it.notes}</em> : null}
              </span>
              <span
                className={`shrink-0 text-[10px] font-bold ${
                  it.itemStatus === "PRONTO" || it.itemStatus === "ENTREGUE"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {it.itemStatus}
              </span>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="mt-1.5 rounded-lg bg-amber-500/15 px-2 py-1 text-amber-900 dark:text-amber-200">
            📝 {order.notes}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between font-semibold">
          <span className="text-[var(--text-secondary)]">
            {order.deliveryFee > 0 ? `Taxa ${formatBRL(order.deliveryFee)}` : isPickup ? "Sem taxa" : "Frete grátis"}
            {order.changeFor ? ` · Troco p/ ${formatBRL(order.changeFor)}` : ""}
          </span>
          <span className="font-mono-num text-sm text-[var(--accent-primary)]">{formatBRL(order.total)}</span>
        </div>

        {(needsCourier || order.courierName) && !isPickup && (
          <div className="mt-2 flex items-center gap-1.5">
            <Bike className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <input
              list="courier-list"
              value={courierDraft[order.id] ?? order.courierName ?? ""}
              onChange={(e) => setCourierDraft((d) => ({ ...d, [order.id]: e.target.value }))}
              placeholder="Nome do entregador"
              className="input-field flex-1 py-1 text-xs"
            />
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {next && (
            <button
              type="button"
              disabled={busyId === order.id}
              onClick={() => handleAdvance(order)}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              {NEXT_LABEL[next] ?? DELIVERY_STATUS_LABELS[next]} →
            </button>
          )}
          {order.status !== "PAGO" && (
            <div className="flex items-center gap-1">
              <select
                value={payDraft[order.id] ?? order.paymentMethod ?? "PIX"}
                onChange={(e) => setPayDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                className="input-field py-1.5 text-[11px]"
                aria-label="Forma de pagamento"
              >
                {["PIX", "DINHEIRO", "CREDITO", "DEBITO"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={busyId === order.id}
                onClick={() => handleCollect(order)}
                className="icon-btn border-emerald-300 bg-emerald-50 text-emerald-800"
                title="Registrar pagamento"
              >
                <Wallet className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="icon-btn text-emerald-700" title="WhatsApp do cliente">
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {!isPickup && order.deliveryAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.deliveryAddress} ${order.deliveryNeighborhood ?? ""}`)}`}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              title="Abrir rota no mapa"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button type="button" onClick={() => copyTrackingLink(order)} className="icon-btn" title="Copiar link de rastreio">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onOpenReceipt(order)} className="icon-btn" title="Cupom / comanda">
            <Receipt className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleCancel(order)}
            className="icon-btn text-red-700 hover:bg-red-50"
            title="Cancelar pedido"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <datalist id="courier-list">
        {couriers.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Header + KPIs */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display flex items-center gap-2 text-2xl font-bold">
            <Truck className="h-6 w-6 text-[var(--accent-primary)]" /> Central de Delivery
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Pedidos online, telefone e retirada · frete grátis acima de {formatBRL(FREE_DELIVERY_ABOVE)} ·
            cardápio público em <a href="/delivery" target="_blank" className="font-semibold text-[var(--accent-primary)] underline">/delivery</a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="segmented">
            {(["board", "history", "zones"] as const).map((v) => (
              <button key={v} type="button" data-active={view === v} onClick={() => setView(v)}>
                {v === "board" ? `Quadro (${active.length})` : v === "history" ? "Histórico" : `Regiões (${zones.length})`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onNewDeliveryOrder}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" /> Pedido por telefone
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Em andamento", value: String(active.length), tone: "text-[var(--accent-primary)]" },
          {
            label: "Atrasados",
            value: String(stats.late),
            tone: stats.late ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
          },
          { label: "Entregues", value: String(stats.delivered), tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Tempo médio", value: stats.avg ? `${stats.avg} min` : "—", tone: "text-[var(--text-primary)]" },
          { label: "A receber na entrega", value: formatBRL(stats.toCollect), tone: "text-amber-600 dark:text-amber-400" },
        ].map((k) => (
          <div key={k.label} className="card-bistro p-3.5">
            <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{k.label}</p>
            <p className={`font-mono-num mt-1 text-xl font-bold ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {view === "board" && (
        <div className="kanban">
          {COLUMNS.map((col) => {
            const Icon = col.icon;
            const list = active.filter((o) => o.deliveryStatus === col.id);
            return (
              <section key={col.id} className="kanban-col">
                <div className={`mb-2.5 flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${col.tone}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-4 w-4" /> {DELIVERY_STATUS_LABELS[col.id]}
                  </span>
                  <span className="font-mono-num rounded-full bg-[var(--bg-surface)]/80 px-2 text-[var(--text-primary)]">
                    {list.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {list.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border-warm)] p-4 text-center text-[11px] text-[var(--text-secondary)]">
                      Nenhum pedido aqui
                    </p>
                  ) : (
                    list.map(renderCard)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "history" && (
        <div className="card-bistro overflow-x-auto p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th className="hidden md:table-cell">Destino</th>
                <th className="hidden sm:table-cell">Entregador</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {finished.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--text-secondary)]">
                    Nenhuma entrega finalizada ainda.
                  </td>
                </tr>
              )}
              {finished.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono-num font-bold">{o.code}</td>
                  <td>{o.customerName}</td>
                  <td className="hidden md:table-cell">
                    {o.channel === "RETIRADA" ? "Retirada no balcão" : o.deliveryNeighborhood}
                  </td>
                  <td className="hidden sm:table-cell">{o.courierName ?? "—"}</td>
                  <td>
                    <span className={`chip ${o.deliveryStatus === "CANCELADO" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {DELIVERY_STATUS_LABELS[(o.deliveryStatus ?? "ENTREGUE") as DeliveryStatus]}
                    </span>
                    {o.status !== "PAGO" && o.deliveryStatus !== "CANCELADO" && (
                      <span className="chip ml-1 bg-amber-100 text-amber-900">a cobrar</span>
                    )}
                  </td>
                  <td className="font-mono-num text-right font-bold">{formatBRL(o.total)}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => onOpenReceipt(o)} className="icon-btn" title="Cupom">
                      <Receipt className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border-warm)] px-4 py-2 text-[11px] text-[var(--text-secondary)]">
            Taxas de entrega arrecadadas: <strong className="font-mono-num">{formatBRL(stats.fees)}</strong>
          </p>
        </div>
      )}

      {view === "zones" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form onSubmit={handleCreateZone} className="card-bistro space-y-2.5 p-5">
            <h3 className="font-display text-lg font-bold">Nova região</h3>
            <label className="field-label">
              Bairro / região
              <input
                required
                minLength={2}
                value={zoneForm.name}
                onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Ex: Jardim Europa"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="field-label">
                Taxa (R$)
                <input type="number" min="0" step="0.5" value={zoneForm.fee} onChange={(e) => setZoneForm((f) => ({ ...f, fee: e.target.value }))} className="input-field" />
              </label>
              <label className="field-label">
                Tempo (min)
                <input type="number" min="5" value={zoneForm.etaMinutes} onChange={(e) => setZoneForm((f) => ({ ...f, etaMinutes: e.target.value }))} className="input-field" />
              </label>
              <label className="field-label">
                Mínimo (R$)
                <input type="number" min="0" value={zoneForm.minOrder} onChange={(e) => setZoneForm((f) => ({ ...f, minOrder: e.target.value }))} className="input-field" />
              </label>
            </div>
            <button type="submit" className="btn-primary w-full rounded-xl py-2.5 text-sm font-bold">
              Cadastrar região
            </button>
          </form>

          <div className="card-bistro overflow-x-auto p-0 lg:col-span-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Região</th>
                  <th className="text-right">Taxa</th>
                  <th className="text-right">Tempo</th>
                  <th className="text-right">Mínimo</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className={z.isActive ? "" : "opacity-50"}>
                    <td className="font-semibold">{z.name}</td>
                    <td className="font-mono-num text-right">{formatBRL(z.fee)}</td>
                    <td className="font-mono-num text-right">{z.etaMinutes} min</td>
                    <td className="font-mono-num text-right">{formatBRL(z.minOrder)}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => zoneRequest("PATCH", { id: z.id, isActive: !z.isActive })}
                          className={`icon-btn ${z.isActive ? "text-emerald-700" : "text-[var(--text-secondary)]"}`}
                          title={z.isActive ? "Pausar entregas" : "Reativar entregas"}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirm(`Excluir ${z.name}?`) && zoneRequest("DELETE", undefined, `?id=${z.id}`)}
                          className="icon-btn text-red-700"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
