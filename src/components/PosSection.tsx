"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Banknote,
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  Scale,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  calculateCashChange,
  calculateOrderTotals,
  formatBRL,
  getLoyaltyTier,
} from "@/lib/domain";
import type {
  CustomerProfileDto,
  OrderDto,
  ProductDto,
  TableWithOrdersDto,
} from "@/types/erp";

interface PosSectionProps {
  products: ProductDto[];
  tables: TableWithOrdersDto[];
  customers: CustomerProfileDto[];
  preselectedTableNumber: number | null;
  preselectedCustomerId: number | null;
  onClearPreselectedTable: () => void;
  onClearPreselectedCustomer: () => void;
  onOrderCreated: (order: OrderDto, openReceipt?: boolean) => Promise<void>;
  onError: (message: string) => void;
}

interface CartItem {
  product: ProductDto;
  qty: number;
  notes: string;
}

const SECTORS = [
  { id: "ALL", label: "Todos" },
  { id: "PADARIA", label: "Padaria" },
  { id: "CONFEITARIA", label: "Confeitaria" },
  { id: "RESTAURANTE", label: "Restaurante" },
  { id: "BEBIDAS", label: "Bebidas" },
];

export function PosSection({
  products,
  tables,
  customers,
  preselectedTableNumber,
  preselectedCustomerId,
  onClearPreselectedTable,
  onClearPreselectedCustomer,
  onOrderCreated,
  onError,
}: PosSectionProps) {
  const [sector, setSector] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [targetTableNumber, setTargetTableNumber] = useState<number | "">(
    preselectedTableNumber ?? "",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">(
    preselectedCustomerId ?? "",
  );
  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO"
  >("PIX");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveTableNumber =
    preselectedTableNumber ??
    (targetTableNumber === "" ? null : targetTableNumber);

  const effectiveCustomerId =
    preselectedCustomerId ??
    (selectedCustomerId === "" ? null : selectedCustomerId);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === effectiveCustomerId) ?? null,
    [customers, effectiveCustomerId],
  );

  const canRedeemLoyalty = Boolean(
    selectedCustomer && selectedCustomer.loyaltyPoints >= 10 && cart.length > 0,
  );
  const effectiveRedeem = canRedeemLoyalty && redeemLoyaltyPoints;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.isAvailable) return false;
      if (sector !== "ALL" && p.category.sector !== sector) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, sector, search]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: cart.map((c) => ({ qty: c.qty, unitPrice: c.product.price })),
        discount: (Number(discount) || 0) + (effectiveRedeem ? 15 : 0),
        applyServiceFee: effectiveTableNumber !== null,
      }),
    [cart, discount, effectiveRedeem, effectiveTableNumber],
  );

  const cashChange = useMemo(() => {
    const rec = Number(cashReceived) || 0;
    return calculateCashChange(totals.total, rec);
  }, [totals.total, cashReceived]);

  function addProduct(product: ProductDto, qtyStep = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx
            ? { ...line, qty: Number((line.qty + qtyStep).toFixed(3)) }
            : line,
        );
      }
      const initialQty = product.unit === "KG" ? 0.5 : qtyStep;
      return [...prev, { product, qty: initialQty, notes: "" }];
    });
  }

  function setItemQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, qty } : i)),
    );
  }

  function setItemNotes(productId: number, notes: string) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, notes } : i)),
    );
  }

  function applyCombo(comboType: "CAFE_MANHA" | "BISTRO") {
    const findMatch = (keywords: string[]) =>
      products.find(
        (p) =>
          p.isAvailable &&
          keywords.some((k) => p.name.toLowerCase().includes(k)),
      );

    const targets =
      comboType === "CAFE_MANHA"
        ? [findMatch(["croissant"]), findMatch(["cappuccino", "café"])]
        : [findMatch(["risoto", "lasanha"]), findMatch(["suco"])];

    const valid = targets.filter((p): p is ProductDto => Boolean(p));
    if (valid.length === 0) {
      onError("Produtos do combo não encontrados no catálogo.");
      return;
    }
    valid.forEach((prod) => addProduct(prod, 1));
    setDiscount((prev) => String((Number(prev) || 0) + 5));
  }

  async function handleSubmit(payNow: boolean) {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const isTable = effectiveTableNumber !== null;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: isTable ? "MESA" : "PDV_BALCAO",
          tableNumber: isTable ? effectiveTableNumber : undefined,
          customerId: effectiveCustomerId ?? undefined,
          customerName:
            customerName.trim() || selectedCustomer?.name || undefined,
          redeemLoyaltyPoints: effectiveRedeem,
          discount: Number(discount) || 0,
          applyServiceFee: isTable,
          notes: orderNotes.trim() || undefined,
          payNow: !isTable && payNow,
          paymentMethod: !isTable && payNow ? paymentMethod : undefined,
          items: cart.map((line) => ({
            productId: line.product.id,
            qty: line.qty,
            notes: line.notes.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? "Erro ao registrar pedido.");
        return;
      }
      setCart([]);
      setDiscount("0");
      setCustomerName("");
      setOrderNotes("");
      setCashReceived("");
      setTargetTableNumber("");
      setSelectedCustomerId("");
      setRedeemLoyaltyPoints(false);
      onClearPreselectedTable();
      onClearPreselectedCustomer();
      await onOrderCreated(json.order, payNow);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in grid gap-5 lg:grid-cols-12">
      {/* Left Catalog */}
      <div className="min-w-0 space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="card-bistro flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6e594b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pão, bolo, prato, bebida ou código..."
              className="w-full rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] py-2 pr-3 pl-9 text-sm outline-none focus:border-[#b5652a]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSector(s.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  sector === s.id
                    ? "bg-[#19110d] text-white"
                    : "bg-[#f2ebe1] text-[#6e594b] hover:text-[#211611]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e8ddd0] bg-gradient-to-r from-[#fff8ee] to-[#f7ede0] px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#8c4517]">
            <Sparkles className="h-3.5 w-3.5 text-[#b5652a]" />
            Combos Rápidos (desc. R$ 5):
          </span>
          <button
            type="button"
            onClick={() => applyCombo("CAFE_MANHA")}
            className="rounded-lg border border-[#d4943a]/40 bg-white px-2.5 py-1 font-semibold text-[#211611] transition hover:border-[#b5652a] hover:bg-[#b5652a] hover:text-white"
          >
            + Café da Manhã (Croissant + Cappuccino)
          </button>
          <button
            type="button"
            onClick={() => applyCombo("BISTRO")}
            className="rounded-lg border border-[#d4943a]/40 bg-white px-2.5 py-1 font-semibold text-[#211611] transition hover:border-[#b5652a] hover:bg-[#b5652a] hover:text-white"
          >
            + Almoço Bistrô (Risoto + Suco)
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className="card-bistro card-bistro-interactive group flex flex-col justify-between p-4 text-left"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-[#f2ebe1] px-2 py-0.5 text-[10px] font-bold text-[#6e594b]">
                    {product.category.sector} · {product.prepStation}
                  </span>
                  {product.unit === "KG" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      <Scale className="h-3 w-3" /> Balança KG
                    </span>
                  )}
                </div>
                <h3 className="mt-2.5 font-semibold text-[#211611] group-hover:text-[#b5652a]">
                  {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#6e594b]">
                  {product.description}
                </p>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-[#f2ebe1] pt-2.5">
                <span className="font-mono-num text-base font-bold text-[#211611]">
                  {formatBRL(product.price)}
                  <span className="text-[11px] font-normal text-[#6e594b]">
                    /{product.unit}
                  </span>
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    product.stockQty <= product.minStockQty
                      ? "text-amber-700"
                      : "text-[#6e594b]"
                  }`}
                >
                  Estq: {product.stockQty}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Cart / Checkout */}
      <div className="lg:col-span-5 xl:col-span-4">
        <div className="card-bistro sticky top-4 p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#f2ebe1] pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#b5652a]" />
              <h2 className="font-display text-lg font-bold text-[#211611]">
                Caixa / Comanda
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-semibold text-red-700 hover:underline"
              >
                Limpar ({cart.length})
              </button>
            )}
          </div>

          <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#6e594b]">
                Destino
              </label>
              <select
                value={effectiveTableNumber ?? ""}
                onChange={(e) => {
                  onClearPreselectedTable();
                  setTargetTableNumber(
                    e.target.value ? Number(e.target.value) : "",
                  );
                }}
                className="w-full rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs font-medium outline-none focus:border-[#b5652a]"
              >
                <option value="">Balcão (Venda Rápida)</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.number}>
                    {t.name} ({t.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#6e594b]">
                Cliente / Identificação
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={selectedCustomer ? selectedCustomer.name : "Ex: João / Balcão"}
                className="w-full rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs outline-none focus:border-[#b5652a]"
              />
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6e594b]">
                <Award className="h-3.5 w-3.5 text-[#b5652a]" /> Clube Fidelidade
              </label>
              {selectedCustomer && (
                <span className="font-mono-num rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {selectedCustomer.loyaltyPoints} pts ·{" "}
                  {getLoyaltyTier(selectedCustomer.loyaltyPoints)}
                </span>
              )}
            </div>
            <select
              value={effectiveCustomerId ?? ""}
              onChange={(e) => {
                onClearPreselectedCustomer();
                setSelectedCustomerId(
                  e.target.value ? Number(e.target.value) : "",
                );
                setRedeemLoyaltyPoints(false);
              }}
              className="mt-1.5 w-full rounded-lg border border-[#e8ddd0] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#b5652a]"
            >
              <option value="">Sem vínculo de fidelidade</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.loyaltyPoints} pts)
                </option>
              ))}
            </select>
            {canRedeemLoyalty && (
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-900">
                <span>Resgatar 10 pts (-R$ 15,00)</span>
                <input
                  type="checkbox"
                  checked={effectiveRedeem}
                  onChange={(e) => setRedeemLoyaltyPoints(e.target.checked)}
                  className="accent-[#2d6a4f]"
                />
              </label>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e8ddd0] bg-[#fbf8f3] p-6 text-center text-xs text-[#6e594b]">
              Clique nos produtos ao lado para adicionar ao carrinho ou lançar na
              comanda da mesa.
            </div>
          ) : (
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {cart.map((line) => (
                <div
                  key={line.product.id}
                  className="rounded-xl border border-[#f2ebe1] bg-[#fbf8f3] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#211611]">
                        {line.product.name}
                      </p>
                      <p className="font-mono-num text-[11px] text-[#6e594b]">
                        {formatBRL(line.product.price)} / {line.product.unit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItemQty(line.product.id, 0)}
                      className="text-[#6e594b] hover:text-red-700"
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {line.product.unit === "KG" && (
                    <div className="mt-2 flex gap-1.5">
                      {[0.2, 0.5, 1].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setItemQty(line.product.id, preset)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            line.qty === preset
                              ? "bg-[#b5652a] text-white"
                              : "border border-[#e8ddd0] bg-white text-[#6e594b]"
                          }`}
                        >
                          {preset === 1 ? "1kg" : `${preset * 1000}g`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setItemQty(
                            line.product.id,
                            Number(
                              (
                                line.qty -
                                (line.product.unit === "KG" ? 0.1 : 1)
                              ).toFixed(3),
                            ),
                          )
                        }
                        className="rounded-lg border border-[#e8ddd0] bg-white p-1 hover:bg-[#f2ebe1]"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        step={line.product.unit === "KG" ? "0.05" : "1"}
                        min="0.05"
                        value={line.qty}
                        onChange={(e) =>
                          setItemQty(
                            line.product.id,
                            Math.max(0.05, Number(e.target.value) || 0),
                          )
                        }
                        className="font-mono-num w-16 rounded-lg border border-[#e8ddd0] bg-white px-2 py-1 text-center text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItemQty(
                            line.product.id,
                            Number(
                              (
                                line.qty +
                                (line.product.unit === "KG" ? 0.1 : 1)
                              ).toFixed(3),
                            ),
                          )
                        }
                        className="rounded-lg border border-[#e8ddd0] bg-white p-1 hover:bg-[#f2ebe1]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#211611]">
                      {formatBRL(line.qty * line.product.price)}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={line.notes}
                    onChange={(e) => setItemNotes(line.product.id, e.target.value)}
                    placeholder="Obs (ex: fatiado, sem açúcar)..."
                    className="mt-2 w-full rounded-lg border border-[#e8ddd0] bg-white px-2.5 py-1 text-[11px] outline-none focus:border-[#b5652a]"
                  />
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Observação geral do pedido (embalagem, entrega)..."
              className="mt-3 w-full rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-3 py-2 text-xs outline-none focus:border-[#b5652a]"
            />
          )}

          <div className="mt-4 space-y-2 border-t border-[#f2ebe1] pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#6e594b]">Subtotal</span>
              <span className="font-mono-num font-semibold">
                {formatBRL(totals.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#6e594b]">Desconto (R$)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="font-mono-num w-24 rounded-lg border border-[#e8ddd0] bg-[#fbf8f3] px-2 py-1 text-right text-xs font-semibold"
              />
            </div>
            {effectiveRedeem && (
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>Desconto Fidelidade (10 pts)</span>
                <span className="font-mono-num">- R$ 15,00</span>
              </div>
            )}
            {totals.serviceFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#6e594b]">Taxa de Serviço (10%)</span>
                <span className="font-mono-num font-semibold">
                  {formatBRL(totals.serviceFee)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#f2ebe1] pt-2 text-base font-bold text-[#211611]">
              <span>Total</span>
              <span className="font-mono-num text-[#b5652a]">
                {formatBRL(totals.total)}
              </span>
            </div>
          </div>

          {effectiveTableNumber === null && (
            <div className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase text-[#6e594b]">
                  Forma de Pagamento (Balcão)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["PIX", "CREDITO", "DEBITO", "DINHEIRO"] as const).map(
                    (pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`rounded-xl py-1.5 text-[11px] font-bold transition ${
                          paymentMethod === pm
                            ? "bg-[#19110d] text-white"
                            : "border border-[#e8ddd0] bg-[#fbf8f3] text-[#6e594b]"
                        }`}
                      >
                        {pm}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {paymentMethod === "DINHEIRO" && totals.total > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-900">
                      <Banknote className="h-3.5 w-3.5" /> Recebido (R$)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={totals.total.toFixed(2)}
                      className="font-mono-num w-24 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-right text-xs font-bold"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-bold text-emerald-900">
                    <span>Troco</span>
                    <span className="font-mono-num">{formatBRL(cashChange)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {effectiveTableNumber === null ? (
              <>
                <button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleSubmit(true)}
                  className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar Venda & Emitir Cupom
                </button>
                <button
                  type="button"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleSubmit(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#e8ddd0] bg-[#fbf8f3] px-4 py-2.5 text-xs font-semibold text-[#211611] hover:bg-[#f2ebe1] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar apenas para KDS (Pagar depois)
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={() => handleSubmit(false)}
                className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" />
                Lançar na{" "}
                {tables.find((t) => t.number === effectiveTableNumber)?.name} &
                KDS
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
