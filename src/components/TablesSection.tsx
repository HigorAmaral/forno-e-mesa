"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Ban,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Plus,
  QrCode,
  Receipt,
  Split,
  Trash2,
  Users,
} from "lucide-react";
import {
  calculateOrderTotals,
  formatBRL,
  roundMoney,
  splitBillAmount,
  validateSplitPayments,
} from "@/lib/domain";
import type {
  OrderDto,
  SplitPaymentPart,
  TableReservationDto,
  TableWithOrdersDto,
} from "@/types/erp";

interface TablesSectionProps {
  tables: TableWithOrdersDto[];
  orders: OrderDto[];
  reservations: TableReservationDto[];
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
    border: "border-[var(--border-warm)]",
    label: "Livre",
  },
  OCUPADA: {
    badge: "bg-amber-100 text-amber-900",
    border: "border-amber-400",
    label: "Ocupada",
  },
  CONTA: {
    badge: "bg-orange-100 text-orange-900 animate-pulse",
    border: "border-orange-500",
    label: "Pedindo Conta",
  },
  RESERVADA: {
    badge: "bg-stone-200 text-stone-800",
    border: "border-stone-400",
    label: "Reservada",
  },
};

export function TablesSection({
  tables,
  orders,
  reservations,
  onOpenPosForTable,
  onOpenQr,
  onOpenReceipt,
  onRefresh,
  onError,
}: TablesSectionProps) {
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [showNewTable, setShowNewTable] = useState(false);
  const [showReservations, setShowReservations] = useState(false);

  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newTableArea, setNewTableArea] = useState<"SALAO" | "VARANDA" | "BALCAO">(
    "SALAO",
  );
  const [newTableCapacity, setNewTableCapacity] = useState("4");

  const [resTableId, setResTableId] = useState<string>("");
  const [resName, setResName] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resPartySize, setResPartySize] = useState("4");
  const [resDateTime, setResDateTime] = useState(() => {
    const d = new Date();
    return `${d.toISOString().slice(0, 10)} 19:30`;
  });
  const [resNotes, setResNotes] = useState("");

  const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null);
  const [transferOrderId, setTransferOrderId] = useState<number | null>(null);
  const [targetTableNumber, setTargetTableNumber] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "MISTO"
  >("CREDITO");
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[]>([
    { method: "PIX", amount: 0 },
    { method: "CREDITO", amount: 0 },
  ]);
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

  async function handleDeleteTable(tableNumber: number) {
    setBusyId(tableNumber);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao remover mesa.");
        return;
      }
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault();
    setBusyId(-2);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: resTableId ? Number(resTableId) : null,
          customerName: resName.trim(),
          customerPhone: resPhone.trim(),
          partySize: Number(resPartySize) || 2,
          reservedFor: resDateTime.trim(),
          notes: resNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao criar reserva.");
        return;
      }
      setResName("");
      setResPhone("");
      setResNotes("");
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function updateReservationStatus(id: number, status: string) {
    const res = await fetch("/api/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      onError("Erro ao atualizar reserva.");
      return;
    }
    await onRefresh();
  }

  async function deleteReservation(id: number) {
    const res = await fetch(`/api/reservations?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      onError("Erro ao excluir reserva.");
      return;
    }
    await onRefresh();
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

  async function dismissWaiter(tableNumber: number) {
    setBusyId(tableNumber);
    try {
      const res = await fetch(`/api/tables/${tableNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISMISS_WAITER" }),
      });
      if (res.ok) await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckout(orderId: number, totalPreview: number) {
    if (paymentMethod === "MISTO") {
      const check = validateSplitPayments(totalPreview, splitParts);
      if (!check.valid) {
        onError(check.error ?? "Valores do pagamento dividido inválidos.");
        return;
      }
    }

    setBusyId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          splitPayments: paymentMethod === "MISTO" ? splitParts : undefined,
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

  const activeReservationsCount = reservations.filter(
    (r) => r.status === "CONFIRMADA",
  ).length;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="card-bistro flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Salão, Varanda, Reservas & Comandas
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Gerencie mesas, reservas, chamados do QR Code, divisão de conta e pagamento misto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReservations((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <CalendarClock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            Reservas ({activeReservationsCount})
          </button>
          <button
            type="button"
            onClick={() => setShowNewTable((v) => !v)}
            className="btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold"
          >
            {showNewTable ? "Fechar Cadastro" : "+ Nova Mesa"}
          </button>
          <div className="segmented">
            {[
              { id: "ALL", label: "Todas" },
              { id: "SALAO", label: "Salão" },
              { id: "VARANDA", label: "Varanda" },
              { id: "BALCAO", label: "Balcão" },
            ].map((area) => (
              <button
                key={area.id}
                type="button"
                data-active={areaFilter === area.id}
                onClick={() => setAreaFilter(area.id)}
              >
                {area.label}
              </button>
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
            className="input-field text-xs"
          />
          <input
            type="text"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="Nome (ex: Mesa 11)"
            className="input-field text-xs"
          />
          <select
            value={newTableArea}
            onChange={(e) =>
              setNewTableArea(e.target.value as "SALAO" | "VARANDA" | "BALCAO")
            }
            className="input-field text-xs"
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
            className="input-field text-xs"
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

      {showReservations && (
        <div className="card-bistro animate-fade-in space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold">
              <CalendarClock className="h-4 w-4 text-[var(--accent-primary)]" />
              Agenda de Reservas
            </h3>
          </div>

          <form onSubmit={handleCreateReservation} className="grid gap-2.5 sm:grid-cols-6">
            <input
              type="text"
              required
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="Nome do cliente *"
              className="input-field text-xs"
            />
            <input
              type="text"
              required
              value={resPhone}
              onChange={(e) => setResPhone(e.target.value)}
              placeholder="WhatsApp *"
              className="input-field text-xs"
            />
            <input
              type="number"
              min="1"
              max="30"
              value={resPartySize}
              onChange={(e) => setResPartySize(e.target.value)}
              placeholder="Pessoas"
              className="input-field text-xs"
            />
            <input
              type="text"
              required
              value={resDateTime}
              onChange={(e) => setResDateTime(e.target.value)}
              placeholder="Data/Hora (2026-11-24 20:00)"
              className="input-field text-xs"
            />
            <select
              value={resTableId}
              onChange={(e) => setResTableId(e.target.value)}
              className="input-field text-xs"
            >
              <option value="">Qualquer mesa</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.capacity} lug)
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busyId === -2}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-bold"
            >
              + Reservar
            </button>
          </form>

          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {reservations.map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)]">
                      {r.customerName} ({r.partySize}p)
                    </span>
                    <span className="chip bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {r.reservedFor} · {r.customerPhone}
                    {r.table ? ` · ${r.table.name}` : ""}
                  </p>
                  {r.notes && (
                    <p className="mt-0.5 text-[11px] italic text-[var(--text-secondary)]">
                      {r.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {r.status === "CONFIRMADA" && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateReservationStatus(r.id, "SENTADA")}
                        className="flex-1 rounded-lg bg-emerald-700 py-1 text-[11px] font-bold text-white"
                      >
                        Check-in / Sentou
                      </button>
                      <button
                        type="button"
                        onClick={() => updateReservationStatus(r.id, "CANCELADA")}
                        className="rounded-lg border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteReservation(r.id)}
                    className="icon-btn ml-auto p-1 text-red-700"
                    title="Remover reserva"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

          const splitValidation = previewTotals
            ? validateSplitPayments(previewTotals.total, splitParts)
            : null;

          return (
            <div
              key={table.id}
              className={`card-bistro flex flex-col justify-between p-4 ${st.border}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                        {table.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.badge}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>{table.area}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {table.capacity} lugares
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenQr(table.number)}
                      className="icon-btn inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      QR
                    </button>
                    {!activeOrder && (
                      <button
                        type="button"
                        disabled={busyId === table.number}
                        onClick={() => handleDeleteTable(table.number)}
                        className="icon-btn p-1.5 text-red-700"
                        title="Excluir mesa"
                        aria-label={`Excluir ${table.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {table.waiterCalledAt && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-950">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <BellRing className="h-3.5 w-3.5 animate-pulse text-orange-700" />
                      Chamando Garçom!
                    </span>
                    <button
                      type="button"
                      disabled={busyId === table.number}
                      onClick={() => dismissWaiter(table.number)}
                      className="rounded-lg bg-orange-700 px-2 py-1 text-[10px] font-bold text-white"
                    >
                      Atendido
                    </button>
                  </div>
                )}

                {activeOrder ? (
                  <div className="mt-4 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-num font-bold text-[var(--text-primary)]">
                        {activeOrder.code}
                      </span>
                      <span className="font-mono-num text-sm font-bold text-[var(--accent-primary)]">
                        {formatBRL(activeOrder.total)}
                      </span>
                    </div>
                    <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-[var(--text-secondary)]">
                      {activeOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-2"
                        >
                          <span className="truncate">
                            {item.qty}× {item.productName}
                          </span>
                          <span className="shrink-0 font-semibold text-[var(--text-primary)]">
                            {item.itemStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-center text-xs text-[var(--text-secondary)]">
                    Nenhuma comanda aberta no momento.
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {checkoutOrderId === activeOrder?.id &&
                activeOrder &&
                previewTotals ? (
                  <div className="space-y-2.5 rounded-xl border border-[var(--accent-primary)]/50 bg-[var(--bg-canvas)] p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[var(--text-primary)]">
                        Fechar {activeOrder.code}
                      </p>
                      <span className="font-mono-num text-sm font-bold text-[var(--accent-primary)]">
                        {formatBRL(previewTotals.total)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={applyServiceFee}
                          onChange={(e) => setApplyServiceFee(e.target.checked)}
                        />
                        Serviço 10%
                      </label>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] text-[var(--text-secondary)]">Desc:</span>
                        <input
                          type="number"
                          min="0"
                          value={checkoutDiscount}
                          onChange={(e) => setCheckoutDiscount(e.target.value)}
                          className="input-field font-mono-num w-16 px-1.5 py-0.5 text-right text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Split Bill */}
                    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                        <Split className="h-3 w-3" /> Dividir por:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={splitPeople}
                          onChange={(e) => setSplitPeople(Number(e.target.value))}
                          className="input-field w-auto px-1.5 py-0.5 text-[11px] font-bold"
                        >
                          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? "pessoa" : "pessoas"}
                            </option>
                          ))}
                        </select>
                        {splitPeople > 1 && (
                          <span className="font-mono-num text-[11px] font-bold text-[var(--accent-primary)]">
                            {formatBRL(
                              splitBillAmount(previewTotals.total, splitPeople),
                            )}
                            /un
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {(["PIX", "CREDITO", "DEBITO", "DINHEIRO", "MISTO"] as const).map(
                        (pm) => (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(pm);
                              if (pm === "MISTO") {
                                const half = roundMoney(previewTotals.total / 2);
                                setSplitParts([
                                  { method: "PIX", amount: half },
                                  {
                                    method: "CREDITO",
                                    amount: roundMoney(previewTotals.total - half),
                                  },
                                ]);
                              }
                            }}
                            className={`rounded-lg py-1 text-[9px] font-bold transition ${
                              paymentMethod === pm
                                ? "bg-[var(--accent-primary)] text-white"
                                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {pm}
                          </button>
                        ),
                      )}
                    </div>

                    {paymentMethod === "MISTO" && (
                      <div className="space-y-1.5 rounded-lg border border-[var(--border-warm)] bg-[var(--bg-surface)] p-2">
                        {splitParts.map((part, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <select
                              value={part.method}
                              onChange={(e) =>
                                setSplitParts((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          method: e.target.value as SplitPaymentPart["method"],
                                        }
                                      : p,
                                  ),
                                )
                              }
                              className="input-field py-0.5 text-[10px]"
                            >
                              <option value="PIX">PIX</option>
                              <option value="CREDITO">Crédito</option>
                              <option value="DEBITO">Débito</option>
                              <option value="DINHEIRO">Dinheiro</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={part.amount}
                              onChange={(e) =>
                                setSplitParts((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, amount: Number(e.target.value) || 0 }
                                      : p,
                                  ),
                                )
                              }
                              className="input-field font-mono-num w-20 py-0.5 text-right text-[10px]"
                            />
                          </div>
                        ))}
                        {splitValidation && !splitValidation.valid && (
                          <p className="text-[10px] font-semibold text-amber-600">
                            {splitValidation.error}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === activeOrder.id}
                        onClick={() =>
                          handleCheckout(activeOrder.id, previewTotals.total)
                        }
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
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
                        className="rounded-lg border border-[var(--border-warm)] px-2.5 py-1.5 text-xs"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : transferOrderId === activeOrder?.id && activeOrder ? (
                  <div className="space-y-2 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] p-3 text-xs">
                    <p className="font-bold text-[var(--text-primary)]">
                      Transferir {activeOrder.code} para:
                    </p>
                    <select
                      value={targetTableNumber}
                      onChange={(e) =>
                        setTargetTableNumber(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="input-field py-1.5 text-xs"
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
                        className="btn-primary flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Transferir
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferOrderId(null)}
                        className="rounded-lg border border-[var(--border-warm)] px-2.5 py-1.5 text-xs"
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
                            className="icon-btn px-2.5 py-2"
                            title="Cupom 80mm"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTransferOrderId(activeOrder.id)}
                          className="icon-btn px-2.5 py-2"
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
                          className="rounded-xl border border-red-500/35 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-500/20 dark:text-red-300"
                          title="Cancelar comanda"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                        {table.status !== "CONTA" && (
                          <button
                            type="button"
                            disabled={busyId === table.number}
                            onClick={() => setTableStatus(table.number, "CONTA")}
                            className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-2.5 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-500/20 dark:text-orange-200"
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
                          className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold"
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
                        className="rounded-xl border border-[var(--border-warm)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"
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
