"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Plus,
  QrCode,
  Receipt,
  Split,
  Users,
} from "lucide-react";
import { calculateOrderTotals, formatBRL, splitBillAmount } from "@/lib/domain";
import type { OrderDto, TableWithOrdersDto } from "@/types/erp";

interface TablesSectionProps {
  tables: TableWithOrdersDto[];
  orders: OrderDto[];
  onOpenPosForTable: (tableNumber: number) => void;
  onOpenQr: (tableNumber: number) => void;
  onOpenReceipt: (order: OrderDto) => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

const TABLE_STYLES: Record<
  string,
  { badge: string; border: string; label: string }
> = {
  LIVRE: {
    badge: "bg-emerald-100 text-emerald-800",
    border: "border-[#e5e4df] bg-white",
    label: "Livre",
  },
  OCUPADA: {
    badge: "bg-amber-100 text-amber-900",
    border: "border-amber-300 bg-amber-50/40",
    label: "Ocupada",
  },
  CONTA: {
    badge: "bg-orange-100 text-orange-900 animate-pulse",
    border: "border-orange-400 bg-orange-50/70",
    label: "Pedindo Conta",
  },
  RESERVADA: {
    badge: "bg-stone-200 text-stone-800",
    border: "border-stone-300 bg-stone-50",
    label: "Reservada",
  },
};

export function TablesSection({
  tables,
  orders,
  onOpenPosForTable,
  onOpenQr,
  onOpenReceipt,
  onRefresh,
  onError,
}: TablesSectionProps) {
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newTableArea, setNewTableArea] = useState<"SALAO" | "VARANDA" | "BALCAO">("SALAO");
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null);
  const [transferOrderId, setTransferOrderId] = useState<number | null>(null);
  const [targetTableNumber, setTargetTableNumber] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO"
  >("CREDITO");
  const [splitPeople, setSplitPeople] = useState(1);
  const [applyServiceFee, setApplyServiceFee] = useState(true);
  const [checkoutDiscount, setCheckoutDiscount] = useState("0");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(newTableNumber);
    if (!Number.isInteger(num) || num <= 0) {
      onError("Informe um número válido para a mesa.");
      return;
    }
    setBusyId(-1);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: num,
          name: newTableName.trim() || `Mesa ${String(num).padStart(2, "0")}`,
          area: newTableArea,
          capacity: Number(newTableCapacity) || 4,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao criar mesa.");
        return;
      }
      setNewTableNumber("");
      setNewTableName("");
      setNewTableCapacity("4");
      setShowNewTable(false);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  const visibleTables = useMemo(() => {
    if (areaFilter === "ALL") return tables;
    return tables.filter((t) => t.area === areaFilter);
  }, [tables, areaFilter]);

  const freeTables = useMemo(
    () => tables.filter((t) => t.orders.length === 0),
    [tables],
  );

  async function setTableStatus(tableNumber: number, status: string) {
    setBusyId(tableNumber);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json();
        onError(j.error ?? "Erro ao atualizar mesa.");
        return;
      }
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckout(orderId: number) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          applyServiceFee,
          discount: Number(checkoutDiscount) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao fechar conta.");
        return;
      }
      setCheckoutOrderId(null);
      setSplitPeople(1);
      setCheckoutDiscount("0");
      await onRefresh();
      onOpenReceipt(json.order);
    } finally {
      setBusyId(null);
    }
  }

  async function handleOrderAction(
    orderId: number,
    action: "CANCEL" | "TRANSFER",
  ) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetTableNumber:
            action === "TRANSFER" && targetTableNumber !== ""
              ? Number(targetTableNumber)
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao atualizar comanda.");
        return;
      }
      setTransferOrderId(null);
      setTargetTableNumber("");
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="card-bistro flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#121417]">
            Salão, Varanda & Comandas
          </h2>
          <p className="text-xs text-[#5a5f67]">
            Controle mesas, divida a conta por pessoas, transfira comandas ou
            gere o QR Code para pedidos pelo celular.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewTable((v) => !v)}
            className="btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold"
          >
            {showNewTable ? "Fechar Cadastro" : "+ Nova Mesa"}
          </button>
          <div className="flex gap-1 rounded-xl bg-[#eeeeea] p-1">
            {[
              { id: "ALL", label: "Todas" },
              { id: "SALAO", label: "Salão" },
              { id: "VARANDA", label: "Varanda" },
              { id: "BALCAO", label: "Balcão" },
            ].map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setAreaFilter(area.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  areaFilter === area.id
                    ? "bg-[#121417] text-white"
                    : "text-[#5a5f67] hover:text-[#121417]"
                }`}
              >
                {area.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {Object.entries(TABLE_STYLES).map(([key, st]) => (
              <span
                key={key}
                className={`rounded-full px-2.5 py-1 font-semibold ${st.badge}`}
              >
                {st.label}: {tables.filter((t) => t.status === key).length}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showNewTable && (
        <form
          onSubmit={handleCreateTable}
          className="card-bistro grid gap-3 p-4 sm:grid-cols-5"
        >
          <input
            type="number"
            min="1"
            required
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            placeholder="Nº da Mesa (ex: 11)"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
          />
          <input
            type="text"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="Nome (ex: Mesa 11)"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
          />
          <select
            value={newTableArea}
            onChange={(e) =>
              setNewTableArea(e.target.value as "SALAO" | "VARANDA" | "BALCAO")
            }
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
          >
            <option value="SALAO">Salão</option>
            <option value="VARANDA">Varanda</option>
            <option value="BALCAO">Balcão</option>
          </select>
          <input
            type="number"
            min="1"
            max="24"
            value={newTableCapacity}
            onChange={(e) => setNewTableCapacity(e.target.value)}
            placeholder="Lugares"
            className="rounded-xl border border-[#e5e4df] bg-[#f6f6f3] px-3 py-2 text-xs outline-none focus:border-[#d95d24]"
          />
          <button
            type="submit"
            disabled={busyId === -1}
            className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {busyId === -1 ? "Salvando..." : "Criar Mesa + QR"}
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleTables.map((table) => {
          const st = TABLE_STYLES[table.status] ?? TABLE_STYLES.LIVRE;
          const activeOrder = table.orders[0] ?? null;
          const fullOrder = activeOrder
            ? orders.find((o) => o.id === activeOrder.id) ?? null
            : null;

          const previewTotals =
            activeOrder && checkoutOrderId === activeOrder.id
              ? calculateOrderTotals({
                  items: activeOrder.items.map((i) => ({
                    qty: i.qty,
                    unitPrice: i.unitPrice,
                  })),
                  discount: Number(checkoutDiscount) || 0,
                  applyServiceFee,
                })
              : null;

          return (
            <div
              key={table.id}
              className={`card-bistro flex flex-col justify-between p-4 ${st.border}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-[#121417]">
                        {table.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.badge}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-[#5a5f67]">
                      <span>{table.area}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {table.capacity} lugares
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenQr(table.number)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e4df] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#121417] hover:border-[#d95d24] hover:text-[#d95d24]"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR
                  </button>
                </div>

                {activeOrder ? (
                  <div className="mt-4 rounded-xl border border-[#e5e4df] bg-white p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-num font-bold text-[#121417]">
                        {activeOrder.code}
                      </span>
                      <span className="font-mono-num text-sm font-bold text-[#d95d24]">
                        {formatBRL(activeOrder.total)}
                      </span>
                    </div>
                    <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-[#5a5f67]">
                      {activeOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-2"
                        >
                          <span className="truncate">
                            {item.qty}× {item.productName}
                          </span>
                          <span className="shrink-0 font-semibold text-[#121417]">
                            {item.itemStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-[#e5e4df] bg-[#f6f6f3]/70 p-3 text-center text-xs text-[#5a5f67]">
                    Nenhuma comanda aberta no momento.
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {checkoutOrderId === activeOrder?.id &&
                activeOrder &&
                previewTotals ? (
                  <div className="space-y-2.5 rounded-xl border border-[#d95d24]/40 bg-white p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#121417]">
                        Fechar {activeOrder.code}
                      </p>
                      <span className="font-mono-num text-sm font-bold text-[#d95d24]">
                        {formatBRL(previewTotals.total)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#5a5f67]">
                        <input
                          type="checkbox"
                          checked={applyServiceFee}
                          onChange={(e) => setApplyServiceFee(e.target.checked)}
                        />
                        Serviço 10%
                      </label>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] text-[#5a5f67]">Desc:</span>
                        <input
                          type="number"
                          min="0"
                          value={checkoutDiscount}
                          onChange={(e) => setCheckoutDiscount(e.target.value)}
                          className="font-mono-num w-16 rounded border border-[#e5e4df] bg-[#f6f6f3] px-1.5 py-0.5 text-right text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Split Bill */}
                    <div className="flex items-center justify-between rounded-lg bg-[#f6f6f3] px-2.5 py-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5a5f67]">
                        <Split className="h-3 w-3" /> Dividir por:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={splitPeople}
                          onChange={(e) => setSplitPeople(Number(e.target.value))}
                          className="rounded border border-[#e5e4df] bg-white px-1.5 py-0.5 text-[11px] font-bold"
                        >
                          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? "pessoa" : "pessoas"}
                            </option>
                          ))}
                        </select>
                        {splitPeople > 1 && (
                          <span className="font-mono-num text-[11px] font-bold text-[#d95d24]">
                            {formatBRL(
                              splitBillAmount(previewTotals.total, splitPeople),
                            )}
                            /un
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map(
                        (pm) => (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => setPaymentMethod(pm)}
                            className={`rounded-lg py-1 text-[10px] font-bold ${
                              paymentMethod === pm
                                ? "bg-[#121417] text-white"
                                : "bg-[#eeeeea] text-[#5a5f67]"
                            }`}
                          >
                            {pm}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === activeOrder.id}
                        onClick={() => handleCheckout(activeOrder.id)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#15803d] py-1.5 text-xs font-semibold text-white hover:bg-[#22523d]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Pago
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutOrderId(null);
                          setSplitPeople(1);
                          setCheckoutDiscount("0");
                        }}
                        className="rounded-lg border border-[#e5e4df] px-2.5 py-1.5 text-xs"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : transferOrderId === activeOrder?.id && activeOrder ? (
                  <div className="space-y-2 rounded-xl border border-[#e5e4df] bg-white p-3 text-xs">
                    <p className="font-bold text-[#121417]">
                      Transferir {activeOrder.code} para:
                    </p>
                    <select
                      value={targetTableNumber}
                      onChange={(e) =>
                        setTargetTableNumber(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="w-full rounded-lg border border-[#e5e4df] bg-[#f6f6f3] px-2 py-1.5 text-xs"
                    >
                      <option value="">Selecione mesa livre...</option>
                      {freeTables.map((ft) => (
                        <option key={ft.id} value={ft.number}>
                          {ft.name} ({ft.area})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={!targetTableNumber || busyId === activeOrder.id}
                        onClick={() =>
                          handleOrderAction(activeOrder.id, "TRANSFER")
                        }
                        className="flex-1 rounded-lg bg-[#121417] py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Transferir
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferOrderId(null)}
                        className="rounded-lg border border-[#e5e4df] px-2.5 py-1.5 text-xs"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenPosForTable(table.number)}
                      className="btn-primary flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Lançar
                    </button>

                    {activeOrder ? (
                      <>
                        {fullOrder && (
                          <button
                            type="button"
                            onClick={() => onOpenReceipt(fullOrder)}
                            className="rounded-xl border border-[#e5e4df] bg-white px-2.5 py-2 text-xs font-semibold text-[#121417] hover:bg-[#eeeeea]"
                            title="Cupom 80mm"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTransferOrderId(activeOrder.id)}
                          className="rounded-xl border border-[#e5e4df] bg-white px-2.5 py-2 text-xs font-semibold text-[#121417] hover:bg-[#eeeeea]"
                          title="Transferir mesa"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === activeOrder.id}
                          onClick={() =>
                            handleOrderAction(activeOrder.id, "CANCEL")
                          }
                          className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                          title="Cancelar comanda"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                        {table.status !== "CONTA" && (
                          <button
                            type="button"
                            disabled={busyId === table.number}
                            onClick={() => setTableStatus(table.number, "CONTA")}
                            className="rounded-xl border border-orange-300 bg-orange-50 px-2.5 py-2 text-xs font-semibold text-orange-900 hover:bg-orange-100"
                          >
                            Conta
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutOrderId(activeOrder.id);
                            setSplitPeople(1);
                            setApplyServiceFee(true);
                            setCheckoutDiscount(String(activeOrder.discount || 0));
                          }}
                          className="rounded-xl bg-[#121417] px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                        >
                          Receber
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === table.number}
                        onClick={() =>
                          setTableStatus(
                            table.number,
                            table.status === "RESERVADA" ? "LIVRE" : "RESERVADA",
                          )
                        }
                        className="rounded-xl border border-[#e5e4df] bg-white px-3 py-2 text-xs font-semibold text-[#5a5f67] hover:bg-[#eeeeea]"
                      >
                        {table.status === "RESERVADA" ? "Liberar" : "Reservar"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
