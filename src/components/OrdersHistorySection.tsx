"use client";

import { useMemo, useState } from "react";
import { Ban, Download, Receipt, Search } from "lucide-react";
import { channelLabel, formatBRL } from "@/lib/domain";
import type { OrderDto } from "@/types/erp";

interface OrdersHistorySectionProps {
  orders: OrderDto[];
  onOpenReceipt: (order: OrderDto) => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function OrdersHistorySection({
  orders,
  onOpenReceipt,
  onRefresh,
  onError,
}: OrdersHistorySectionProps) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter === "OPEN" && ["PAGO", "CANCELADO"].includes(o.status)) {
        return false;
      }
      if (statusFilter === "DELIVERY" && o.channel !== "DELIVERY" && o.channel !== "RETIRADA") {
        return false;
      }
      if (statusFilter === "PAGO" && o.status !== "PAGO") return false;
      if (statusFilter === "CANCELADO" && o.status !== "CANCELADO") return false;
      if (
        q &&
        !o.code.toLowerCase().includes(q) &&
        !(o.customerName ?? "").toLowerCase().includes(q) &&
        !(o.table?.name ?? "").toLowerCase().includes(q) &&
        !(o.deliveryNeighborhood ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  async function cancelOrder(orderId: number) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao cancelar pedido.");
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
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (PED-0001), cliente ou mesa..."
              className="input-field rounded-xl py-2 pr-3 pl-9 text-xs"
            />
          </div>

          <div className="segmented">
            {[
              { id: "ALL", label: "Todos" },
              { id: "OPEN", label: "Em Aberto" },
              { id: "DELIVERY", label: "Delivery" },
              { id: "PAGO", label: "Pagos" },
              { id: "CANCELADO", label: "Cancelados" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                data-active={statusFilter === st.id}
                onClick={() => setStatusFilter(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <a
          href="/api/reports/export"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV (Excel)
        </a>
      </div>

      <div className="card-bistro overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Canal / Origem</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th className="text-right">Total</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="font-mono-num font-bold text-[var(--text-primary)]">
                      {order.code}
                    </span>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </td>
                  <td>
                    <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {order.table ? order.table.name : channelLabel(order.channel)}
                    </span>
                  </td>
                  <td className="font-medium">
                    {order.customerName ?? "-"}
                  </td>
                  <td className="max-w-56 truncate text-[var(--text-secondary)]">
                    {order.items
                      .map((i) => `${i.qty}× ${i.productName}`)
                      .join(", ")}
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        order.status === "PAGO"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : order.status === "CANCELADO"
                            ? "bg-red-500/15 text-red-700 dark:text-red-300"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="text-[var(--text-secondary)]">
                    {order.paymentMethod ?? "Em aberto"}
                  </td>
                  <td className="font-mono-num text-right font-bold text-[var(--text-primary)]">
                    {formatBRL(order.total)}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(order)}
                        className="icon-btn"
                        title="Imprimir cupom"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </button>
                      {!["PAGO", "CANCELADO"].includes(order.status) && (
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => cancelOrder(order.id)}
                          className="icon-btn border-red-500/35 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                          title="Cancelar pedido"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
