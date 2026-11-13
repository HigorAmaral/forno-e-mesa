"use client";

import { useMemo, useState } from "react";
import { Ban, Download, Receipt, Search } from "lucide-react";
import { formatBRL } from "@/lib/domain";
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
      if (statusFilter === "PAGO" && o.status !== "PAGO") return false;
      if (statusFilter === "CANCELADO" && o.status !== "CANCELADO") return false;
      if (
        q &&
        !o.code.toLowerCase().includes(q) &&
        !(o.customerName ?? "").toLowerCase().includes(q) &&
        !(o.table?.name ?? "").toLowerCase().includes(q)
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
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6e594b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (PED-0001), cliente ou mesa..."
              className="w-full rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] py-2 pr-3 pl-9 text-xs outline-none focus:border-[#b5652a]"
            />
          </div>

          <div className="flex gap-1 rounded-xl bg-[#f2ebe1] p-1">
            {[
              { id: "ALL", label: "Todos" },
              { id: "OPEN", label: "Em Aberto" },
              { id: "PAGO", label: "Pagos" },
              { id: "CANCELADO", label: "Cancelados" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  statusFilter === st.id
                    ? "bg-[#19110d] text-white"
                    : "text-[#6e594b]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <a
          href="/api/reports/export"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2d6a4f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#22523d]"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV (Excel)
        </a>
      </div>

      <div className="card-bistro overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#f2ebe1] bg-[#fbf8f3] text-[11px] font-bold uppercase text-[#6e594b]">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Canal / Origem</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2ebe1]">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-[#fbf8f3]/60">
                  <td className="px-4 py-3">
                    <span className="font-mono-num font-bold text-[#211611]">
                      {order.code}
                    </span>
                    <p className="text-[10px] text-[#6e594b]">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-[#f2ebe1] px-2 py-0.5 text-[10px] font-bold">
                      {order.table ? order.table.name : order.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {order.customerName ?? "-"}
                  </td>
                  <td className="max-w-56 truncate px-4 py-3 text-[#6e594b]">
                    {order.items
                      .map((i) => `${i.qty}× ${i.productName}`)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        order.status === "PAGO"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.status === "CANCELADO"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6e594b]">
                    {order.paymentMethod ?? "Em aberto"}
                  </td>
                  <td className="font-mono-num px-4 py-3 text-right font-bold text-[#211611]">
                    {formatBRL(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(order)}
                        className="rounded-lg border border-[#e8ddd0] bg-white p-1.5 hover:bg-[#f2ebe1]"
                        title="Imprimir cupom"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </button>
                      {!["PAGO", "CANCELADO"].includes(order.status) && (
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => cancelOrder(order.id)}
                          className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
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
